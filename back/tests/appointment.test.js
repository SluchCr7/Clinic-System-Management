const request = require("supertest");
const app = require("../index");
const Appointment = require("../modules/Appointment/appointment.model");
const Schedule = require("../modules/Schedule/schedule.model");
const Visit = require("../modules/Visit/visit.model");
const AuditLog = require("../modules/AuditLog/auditLog.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
  assignTestDoctor,
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
    ({ doctor, doctorUser } = await createTestDoctor(admin.user));
    await assignTestDoctor(receptionist.user, doctor, admin.user);
    patient = await createTestPatient(receptionist.user, { doctor: doctor._id });
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
    expect(response.body.data.statusHistory).toHaveLength(1);
    expect(response.body.data.statusHistory[0].to).toBe("scheduled");
    expect(new Date(response.body.data.noShowEligibleAt).getTime()).toBe(
      appointmentDate.getTime() + 15 * 60 * 1000
    );

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

  test("accepts a booked slot near midnight when the clinic date must stay on the same weekday", async () => {
    const clinicDate = getFutureAppointmentDate(7);
    const dateStr = clinicDate.toISOString().split("T")[0];
    await Schedule.deleteMany({ doctor: doctor._id });
    await createTestSchedule(doctor, receptionist.user, clinicDate);

    const response = await request(app)
      .post("/api/appointments")
      .set("Authorization", receptionist.authHeader)
      .send({
        patient: patient._id.toString(),
        doctor: doctor._id.toString(),
        appointmentDate: `${dateStr}T23:30`,
        duration: 30,
        reason: "Late evening checkup",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.doctor).toBe(doctor._id.toString());
  });

  test("rejects a doctor who is not scheduled for the selected clinic day", async () => {
    const clinicDate = getFutureAppointmentDate(7);
    const otherDate = new Date(clinicDate.getTime() + 24 * 60 * 60 * 1000);
    const dateStr = clinicDate.toISOString().split("T")[0];
    await Schedule.deleteMany({ doctor: doctor._id });
    await createTestSchedule(doctor, receptionist.user, otherDate);

    const response = await request(app)
      .post("/api/appointments")
      .set("Authorization", receptionist.authHeader)
      .send({
        patient: patient._id.toString(),
        doctor: doctor._id.toString(),
        appointmentDate: `${dateStr}T23:30`,
        duration: 30,
        reason: "Outside working day",
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("DOCTOR_NOT_AVAILABLE");
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

  test("prevents concurrent requests from booking the same doctor slot", async () => {
    const createRequest = () =>
      request(app)
        .post("/api/appointments")
        .set("Authorization", receptionist.authHeader)
        .send(createAppointmentPayload());

    const responses = await Promise.all([createRequest(), createRequest()]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(await Appointment.countDocuments()).toBe(1);
  });

  test("rejects a follow-up linked to a visit for another patient", async () => {
    const sourceAppointment = await createSavedAppointment({
      status: "completed",
    });
    const sourceVisit = await Visit.create({
      appointment: sourceAppointment._id,
      patient: patient._id,
      doctor: doctor._id,
      chiefComplaint: "Follow-up reference test",
      createdBy: receptionist.user._id,
    });
    const otherPatient = await createTestPatient(receptionist.user, {
      doctor: doctor._id,
    });
    const followUpDate = getFutureAppointmentDate(5);
    await createTestSchedule(doctor, receptionist.user, followUpDate);

    const response = await request(app)
      .post("/api/appointments")
      .set("Authorization", doctorUser.authHeader)
      .send(
        createAppointmentPayload({
          patient: otherPatient._id.toString(),
          appointmentDate: followUpDate.toISOString(),
          isFollowUp: true,
          originatingVisit: sourceVisit._id.toString(),
        })
      );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("FOLLOW_UP_VISIT_MISMATCH");
  });

  test("does not allow receptionists to create medical follow-up appointments", async () => {
    const sourceAppointment = await createSavedAppointment({
      status: "completed",
    });
    const sourceVisit = await Visit.create({
      appointment: sourceAppointment._id,
      patient: patient._id,
      doctor: doctor._id,
      chiefComplaint: "Follow-up permission test",
      createdBy: doctorUser.user._id,
    });
    const followUpDate = getFutureAppointmentDate(5);
    await createTestSchedule(doctor, receptionist.user, followUpDate);

    const response = await request(app)
      .post("/api/appointments")
      .set("Authorization", receptionist.authHeader)
      .send(
        createAppointmentPayload({
          appointmentDate: followUpDate.toISOString(),
          isFollowUp: true,
          originatingVisit: sourceVisit._id.toString(),
        })
      );

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  test("allows the assigned doctor to create a follow-up for a completed appointment", async () => {
    const sourceAppointment = await createSavedAppointment({
      status: "completed",
    });
    const sourceVisit = await Visit.create({
      appointment: sourceAppointment._id,
      patient: patient._id,
      doctor: doctor._id,
      chiefComplaint: "Follow-up visit",
      createdBy: doctorUser.user._id,
    });
    const followUpDate = getFutureAppointmentDate(5);
    await createTestSchedule(doctor, receptionist.user, followUpDate);

    const response = await request(app)
      .post("/api/appointments")
      .set("Authorization", doctorUser.authHeader)
      .send(
        createAppointmentPayload({
          appointmentDate: followUpDate.toISOString(),
          isFollowUp: true,
          originatingVisit: sourceVisit._id.toString(),
          followUpReason: "Review symptoms after treatment",
        })
      );

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("scheduled");
    expect(response.body.data.isFollowUp).toBe(true);
    expect(response.body.data.followUpOf).toBe(sourceAppointment._id.toString());
    expect(response.body.data.followUpReason).toBe(
      "Review symptoms after treatment"
    );

    const receptionistView = await request(app)
      .get(`/api/appointments/${response.body.data._id}`)
      .set("Authorization", receptionist.authHeader);
    expect(receptionistView.status).toBe(200);
    expect(receptionistView.body.data.followUpReason).toBeUndefined();
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
    expect(cancelResponse.body.data.cancelledBy).toBe(
      receptionist.user._id.toString()
    );
    expect(cancelResponse.body.data.cancelledAt).toBeTruthy();
    expect(cancelResponse.body.data.statusHistory[0].reason).toBe(
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

  test("requires a cancellation reason", async () => {
    const appointment = await createSavedAppointment();

    const response = await request(app)
      .delete(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect((await Appointment.findById(appointment._id)).status).toBe(
      "scheduled"
    );
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
    expect(checkInRes.body.data.checkedInBy).toBe(
      receptionist.user._id.toString()
    );
    expect(checkInRes.body.data.checkedInAt).toBeTruthy();
    expect(checkInRes.body.data.statusHistory).toHaveLength(2);

    const duplicateCheckIn = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "checked_in" });
    expect(duplicateCheckIn.status).toBe(400);
    expect(duplicateCheckIn.body.code).toBe("INVALID_STATUS_TRANSITION");

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

    // Doctors must start examinations through the visit workflow.
    await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "confirmed" });

    await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", doctorUser.authHeader)
      .send({ status: "in_progress" })
      .expect(400);

    const inProgressAppointment = await createSavedAppointment({
      status: "in_progress",
    });
    await Visit.create({
      appointment: inProgressAppointment._id,
      patient: patient._id,
      doctor: doctor._id,
      chiefComplaint: "Completion permission test",
      createdBy: doctorUser.user._id,
    });
    const recCompleteRes = await request(app)
      .patch(`/api/appointments/${inProgressAppointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "completed" });
    expect(recCompleteRes.status).toBe(403);
    expect(recCompleteRes.body.code).toBe("FORBIDDEN");
  });

  test("requires visits to be started through the assigned doctor's workflow", async () => {
    const appointment = await createSavedAppointment();
    await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "checked_in" })
      .expect(200);

    const response = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", doctorUser.authHeader)
      .send({ status: "in_progress" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VISIT_WORKFLOW_REQUIRED");
    expect((await Appointment.findById(appointment._id)).status).toBe(
      "checked_in"
    );
  });

  test("prevents completing an appointment before a visit is recorded", async () => {
    const appointment = await createSavedAppointment({ status: "in_progress" });

    const response = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", doctorUser.authHeader)
      .send({ status: "completed" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VISIT_REQUIRED_FOR_COMPLETION");
    expect((await Appointment.findById(appointment._id)).status).toBe(
      "in_progress"
    );
  });

  test("prevents completing an appointment while its visit is still in progress", async () => {
    const appointment = await createSavedAppointment({ status: "in_progress" });
    await Visit.create({
      appointment: appointment._id,
      patient: patient._id,
      doctor: doctor._id,
      chiefComplaint: "Unfinished visit",
      status: "in_progress",
      createdBy: doctorUser.user._id,
    });

    const response = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", doctorUser.authHeader)
      .send({ status: "completed" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VISIT_NOT_COMPLETED");
    expect((await Appointment.findById(appointment._id)).status).toBe(
      "in_progress"
    );
  });

  test("rejects manual no-show before the configured grace period", async () => {
    const appointment = await createSavedAppointment({
      status: "confirmed",
      appointmentDate: new Date(Date.now() - 10 * 60 * 1000),
    });

    const response = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "no-show" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("NO_SHOW_TOO_EARLY");
    expect((await Appointment.findById(appointment._id)).status).toBe(
      "confirmed"
    );
  });

  test("does not allow a checked-in appointment to become a no-show", async () => {
    const appointment = await createSavedAppointment({
      status: "checked_in",
      checkedInAt: new Date(Date.now() - 30 * 60 * 1000),
    });

    const response = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "no-show" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_STATUS_TRANSITION");
    expect((await Appointment.findById(appointment._id)).status).toBe(
      "checked_in"
    );
  });

  test("records an eligible manual no-show with actor and history", async () => {
    const appointment = await createSavedAppointment({
      status: "confirmed",
      appointmentDate: new Date(Date.now() - 20 * 60 * 1000),
    });

    const response = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({ status: "no-show" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("no-show");
    expect(response.body.data.noShowBy).toBe(receptionist.user._id.toString());
    expect(response.body.data.noShowMethod).toBe("manual");
    expect(response.body.data.statusHistory.at(-1).to).toBe("no-show");
  });

  test("does not allow administrators to change appointment status", async () => {
    const appointment = await createSavedAppointment();

    const response = await request(app)
      .patch(`/api/appointments/${appointment._id}`)
      .set("Authorization", admin.authHeader)
      .send({ status: "confirmed" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
    expect((await Appointment.findById(appointment._id)).status).toBe(
      "scheduled"
    );
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
