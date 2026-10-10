const request = require("supertest");
const app = require("../index");
const Prescription = require("../modules/Prescription/prescription.model");
const Appointment = require("../modules/Appointment/appointment.model");
const Visit = require("../modules/Visit/visit.model");
const AuditLog = require("../modules/AuditLog/auditLog.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
  getFutureAppointmentDate,
} = require("./testHelper");

describe("Prescriptions API", () => {
  let admin;
  let receptionist;
  let patient;
  let doctor;
  let doctorUser;
  let visit;

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
    receptionist = await createTestUser({ role: "receptionist" });
    patient = await createTestPatient(receptionist.user);
    ({ doctor, doctorUser } = await createTestDoctor(receptionist.user));

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      appointmentDate: getFutureAppointmentDate(),
      duration: 30,
      status: "confirmed",
      createdBy: receptionist.user._id,
    });
    visit = await Visit.create({
      appointment: appointment._id,
      patient: patient._id,
      doctor: doctor._id,
      chiefComplaint: "Persistent cough",
      symptoms: ["cough", "sore throat"],
      createdBy: receptionist.user._id,
    });
  });

  const prescriptionPayload = (overrides = {}) => ({
    visit: visit._id.toString(),
    patient: patient._id.toString(),
    doctor: doctor._id.toString(),
    medications: [
      {
        name: "Amoxicillin",
        dosage: "500 mg",
        frequency: "Three times daily",
        duration: "7 days",
        route: "oral",
        instructions: "Take after meals",
      },
    ],
    generalInstructions: "Complete the full course",
    notes: "Review if symptoms persist",
    ...overrides,
  });

  test("creates a prescription for a visit and records an audit log", async () => {
    const response = await request(app)
      .post("/api/prescriptions")
      .set("Authorization", doctorUser.authHeader)
      .send(prescriptionPayload());

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.patient).toBe(patient._id.toString());
    expect(response.body.data.doctor).toBe(doctor._id.toString());
    expect(response.body.data.visit).toBe(visit._id.toString());
    expect(response.body.data.medications).toHaveLength(1);

    const [savedPrescription, auditLog] = await Promise.all([
      Prescription.findById(response.body.data._id),
      AuditLog.findOne({
        action: "PRESCRIPTION_CREATED",
        resourceId: response.body.data._id,
      }),
    ]);
    expect(savedPrescription.createdBy.toString()).toBe(
      doctorUser.user._id.toString()
    );
    expect(auditLog).not.toBeNull();
    expect(auditLog.actor.toString()).toBe(doctorUser.user._id.toString());
  });

  test("retrieves a prescription with its patient, doctor, and visit details", async () => {
    const prescription = await Prescription.create({
      ...prescriptionPayload(),
      createdBy: doctorUser.user._id,
    });

    const response = await request(app)
      .get(`/api/prescriptions/${prescription._id}`)
      .set("Authorization", receptionist.authHeader);

    expect(response.status).toBe(200);
    expect(response.body.data.patient.firstName).toBe(patient.firstName);
    expect(response.body.data.doctor._id).toBe(doctor._id.toString());
    expect(response.body.data.visit._id).toBe(visit._id.toString());
    expect(response.body.data.medications[0].name).toBe("Amoxicillin");
  });

  test("allows a doctor to update their own prescription and records the update", async () => {
    const prescription = await Prescription.create({
      ...prescriptionPayload(),
      createdBy: doctorUser.user._id,
    });

    const response = await request(app)
      .patch(`/api/prescriptions/${prescription._id}`)
      .set("Authorization", doctorUser.authHeader)
      .send({ notes: "Symptoms improving" });

    expect(response.status).toBe(200);
    expect(response.body.data.notes).toBe("Symptoms improving");
    expect(
      await AuditLog.findOne({
        action: "PRESCRIPTION_UPDATED",
        resourceId: prescription._id,
      })
    ).not.toBeNull();
  });

  test("rejects prescription creation by a receptionist", async () => {
    const response = await request(app)
      .post("/api/prescriptions")
      .set("Authorization", receptionist.authHeader)
      .send(prescriptionPayload());

    expect(response.status).toBe(403);
    expect(await Prescription.countDocuments()).toBe(0);
  });

  test("prevents a doctor from creating prescriptions for another doctor", async () => {
    const otherDoctor = await createTestDoctor(admin.user);

    const response = await request(app)
      .post("/api/prescriptions")
      .set("Authorization", doctorUser.authHeader)
      .send(prescriptionPayload({ doctor: otherDoctor.doctor._id.toString() }));

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  test("validates medication payloads and returns 404 for missing prescriptions", async () => {
    const invalid = await request(app)
      .post("/api/prescriptions")
      .set("Authorization", admin.authHeader)
      .send(prescriptionPayload({ medications: [] }));

    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("VALIDATION_ERROR");

    const missing = await request(app)
      .get("/api/prescriptions/507f1f77bcf86cd799439011")
      .set("Authorization", admin.authHeader);

    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("PRESCRIPTION_NOT_FOUND");
  });

  test("requires authentication to list prescriptions", async () => {
    await request(app).get("/api/prescriptions").expect(401);
  });
});
