const request = require("supertest");
const app = require("../index");
const Appointment = require("../modules/Appointment/appointment.model");
const AuditLog = require("../modules/AuditLog/auditLog.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
  createTestSchedule,
  getFutureAppointmentDate,
} = require("./testHelper");

describe("Appointments API", () => {
  let admin;
  let receptionist;
  let doctorUser;
  let doctor;
  let patient;
  let appointmentDate;

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
    receptionist = await createTestUser({ role: "receptionist" });
    patient = await createTestPatient(receptionist.user);
    ({ doctor, doctorUser } = await createTestDoctor(receptionist.user));
    appointmentDate = getFutureAppointmentDate();
    await createTestSchedule(doctor, receptionist.user, appointmentDate);
  });

  const createAppointmentPayload = (overrides = {}) => ({
    patient: patient._id.toString(),
    doctor: doctor._id.toString(),
    appointmentDate: appointmentDate.toISOString(),
    duration: 30,
    reason: "Routine consultation",
    ...overrides,
  });

  const createSavedAppointment = (overrides = {}) =>
    Appointment.create({
      ...createAppointmentPayload(),
      appointmentDate,
      createdBy: receptionist.user._id,
      ...overrides,
    });

  test("schedules an appointment and records an audit log", async () => {
    const response = await request(app)
      .post("/api/appointments")
      .set("Authorization", receptionist.authHeader)
      .send(createAppointmentPayload());

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.patient).toBe(patient._id.toString());
    expect(response.body.data.doctor).toBe(doctor._id.toString());
    expect(response.body.data.status).toBe("scheduled");
    expect(response.body.data.reminderSent).toBe(false);

    const [savedAppointment, auditLog] = await Promise.all([
      Appointment.findById(response.body.data._id),
      AuditLog.findOne({
        action: "APPOINTMENT_CREATED",
        resourceId: response.body.data._id,
      }),
    ]);

    expect(savedAppointment).not.toBeNull();
    expect(savedAppointment.createdBy.toString()).toBe(
      receptionist.user._id.toString()
    );
    expect(auditLog).not.toBeNull();
  });

  test("rejects overlapping appointments for the same doctor", async () => {
    await createSavedAppointment();

    const response = await request(app)
      .post("/api/appointments")
      .set("Authorization", receptionist.authHeader)
      .send(createAppointmentPayload());

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("APPOINTMENT_CONFLICT");
    expect(await Appointment.countDocuments()).toBe(1);
  });

  test("validates required appointment fields", async () => {
    const response = await request(app)
      .post("/api/appointments")
      .set("Authorization", receptionist.authHeader)
      .send({ patient: patient._id.toString() });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  test("allows scheduled appointments to be confirmed and records the update", async () => {
    const appointment = await createSavedAppointment();

    const response = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "confirmed" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("confirmed");

    const [savedAppointment, auditLog] = await Promise.all([
      Appointment.findById(appointment._id),
      AuditLog.findOne({
        action: "APPOINTMENT_UPDATED",
        resourceId: appointment._id,
      }),
    ]);

    expect(savedAppointment.updatedBy.toString()).toBe(
      receptionist.user._id.toString()
    );
    expect(auditLog).not.toBeNull();
  });

  test("cancels an appointment with a reason and prevents status reversal", async () => {
    const appointment = await createSavedAppointment();

    const cancelResponse = await request(app)
      .delete(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ cancellationReason: "Patient requested cancellation" });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.data.status).toBe("cancelled");
    expect(cancelResponse.body.data.cancellationReason).toBe(
      "Patient requested cancellation"
    );

    const auditLog = await AuditLog.findOne({
      action: "APPOINTMENT_CANCELLED",
      resourceId: appointment._id,
    });
    expect(auditLog).not.toBeNull();

    const reversal = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "scheduled" });

    expect(reversal.status).toBe(400);
    expect(reversal.body.code).toBe("INVALID_STATUS_TRANSITION");
  });

  test("resets the reminder flag when an appointment is rescheduled", async () => {
    const appointment = await createSavedAppointment({ reminderSent: true });
    const rescheduledDate = getFutureAppointmentDate(4);
    await createTestSchedule(doctor, receptionist.user, rescheduledDate);

    const response = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ appointmentDate: rescheduledDate.toISOString() });

    expect(response.status).toBe(200);
    expect(response.body.data.reminderSent).toBe(false);
  });

  test("restricts scheduling to administrators and receptionists", async () => {
    const response = await request(app)
      .post("/api/appointments")
      .set("Authorization", doctorUser.authHeader)
      .send(createAppointmentPayload());

    expect(response.status).toBe(403);
    expect(await Appointment.countDocuments()).toBe(0);
  });

  test("requires authentication and returns 404 for an unknown appointment", async () => {
    await request(app).get("/api/appointments").expect(401);

    const response = await request(app)
      .get("/api/appointments/507f1f77bcf86cd799439011")
      .set("Authorization", admin.authHeader);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("APPOINTMENT_NOT_FOUND");
  });

  test("limits doctors to their own appointment details", async () => {
    const otherDoctor = await createTestDoctor(receptionist.user);
    const appointment = await createSavedAppointment();
    const otherAppointment = await createSavedAppointment({
      doctor: otherDoctor.doctor._id,
      appointmentDate: new Date(appointmentDate.getTime() + 60 * 60 * 1000),
    });

    const ownResponse = await request(app)
      .get(`/api/appointments/${appointment._id}`)
      .set("Authorization", doctorUser.authHeader);
    const otherResponse = await request(app)
      .get(`/api/appointments/${otherAppointment._id}`)
      .set("Authorization", doctorUser.authHeader);

    expect(ownResponse.status).toBe(200);
    expect(otherResponse.status).toBe(404);
  });

  test("enforces strict appointment lifecycle: scheduled -> confirmed -> checked_in", async () => {
    const appointment = await createSavedAppointment();

    // Confirm
    const confirmRes = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "confirmed" });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe("confirmed");

    // Check in
    const checkInRes = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "checked_in" });
    expect(checkInRes.status).toBe(200);
    expect(checkInRes.body.data.status).toBe("checked_in");

    // Reverting checked_in to scheduled is rejected
    const revertRes = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "scheduled" });
    expect(revertRes.status).toBe(400);
    expect(revertRes.body.code).toBe("INVALID_STATUS_TRANSITION");
  });

  test("rejects unauthorized status transitions based on user role", async () => {
    const appointment = await createSavedAppointment();

    // Doctor cannot confirm appointments (receptionist/admin duty)
    const docConfirmRes = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", doctorUser.authHeader)
      .send({ status: "confirmed" });
    expect(docConfirmRes.status).toBe(403);
    expect(docConfirmRes.body.code).toBe("FORBIDDEN");

    // Doctor can transition confirmed -> in_progress, but receptionist cannot complete clinical encounters
    await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "confirmed" });

    await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", doctorUser.authHeader)
      .send({ status: "in_progress" });

    // Receptionist cannot complete an in_progress clinical encounter
    const recCompleteRes = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "completed" });
    expect(recCompleteRes.status).toBe(403);
    expect(recCompleteRes.body.code).toBe("FORBIDDEN");
  });

  test("prevents doctor from modifying another doctor's appointment", async () => {
    const otherDoctor = await createTestDoctor(receptionist.user);
    const appointment = await createSavedAppointment({
      doctor: otherDoctor.doctor._id,
    });

    const docUpdateRes = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", doctorUser.authHeader)
      .send({ notes: "Unauthorized edit" });

    expect(docUpdateRes.status).toBe(403);
    expect(docUpdateRes.body.code).toBe("FORBIDDEN");
  });
});
