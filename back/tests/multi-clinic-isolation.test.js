const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const Patient = require("../modules/Patient/patient.model");
const Doctor = require("../modules/Doctor/doctor.model");
const DoctorAssignment = require("../modules/DoctorAssignment/doctorAssignment.model");
const Appointment = require("../modules/Appointment/appointment.model");
const Visit = require("../modules/Visit/visit.model");
const Invoice = require("../modules/Invoice/invoice.model");
const Payment = require("../modules/Payment/payment.model");
const Prescription = require("../modules/Prescription/prescription.model");
const {
  createTestUser,
  createTestDoctor,
  assignTestDoctor,
  createTestSchedule,
  getFutureAppointmentDate,
} = require("./testHelper");

describe("Multi-Clinic Isolation & Assignment Access Control", () => {
  let admin;
  let receptionistA;
  let receptionistB;
  let doctorUserA;
  let doctorA;
  let doctorUserB;
  let doctorB;
  let patientA;
  let patientB;
  let scheduleDateA;
  let scheduleDateB;

  beforeAll(async () => {
    await Patient.init();
    await DoctorAssignment.init();
    await Invoice.init();
  });

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
    receptionistA = await createTestUser({ role: "receptionist" });
    receptionistB = await createTestUser({ role: "receptionist" });

    ({ doctor: doctorA, doctorUser: doctorUserA } = await createTestDoctor(admin.user));
    ({ doctor: doctorB, doctorUser: doctorUserB } = await createTestDoctor(admin.user));

    // Assign Receptionist A -> Doctor A only
    await assignTestDoctor(receptionistA.user, doctorA, admin.user);

    // Assign Receptionist B -> Doctor B only
    await assignTestDoctor(receptionistB.user, doctorB, admin.user);

    // Create Patient in Doctor A clinic by Receptionist A
    patientA = await Patient.create({
      firstName: "Alice",
      lastName: "Smith",
      dateOfBirth: new Date("1990-05-15"),
      gender: "female",
      phone: `555-0101-${Date.now()}`,
      doctor: doctorA._id,
      createdBy: receptionistA.user._id,
    });

    // Create Patient in Doctor B clinic by Receptionist B
    patientB = await Patient.create({
      firstName: "Bob",
      lastName: "Jones",
      dateOfBirth: new Date("1985-10-20"),
      gender: "male",
      phone: `555-0202-${Date.now()}`,
      doctor: doctorB._id,
      createdBy: receptionistB.user._id,
    });

    scheduleDateA = getFutureAppointmentDate(3);
    scheduleDateB = getFutureAppointmentDate(4);
    await createTestSchedule(doctorA, admin.user, scheduleDateA);
    await createTestSchedule(doctorB, admin.user, scheduleDateB);
  });

  describe("1. Patient Creation Boundaries", () => {
    test("Receptionist A can create a patient assigned to Doctor A", async () => {
      const res = await request(app)
        .post("/api/patients")
        .set("Authorization", receptionistA.authHeader)
        .send({
          doctor: doctorA._id.toString(),
          firstName: "Carol",
          lastName: "White",
          dateOfBirth: "1992-03-10",
          gender: "female",
          phone: `555-0303-${Date.now()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.doctor._id).toBe(doctorA._id.toString());
      expect(res.body.data.createdBy).toBe(receptionistA.user._id.toString());
    });

    test("Receptionist A cannot assign a patient to unassigned Doctor B (403)", async () => {
      const res = await request(app)
        .post("/api/patients")
        .set("Authorization", receptionistA.authHeader)
        .send({
          doctor: doctorB._id.toString(),
          firstName: "Eve",
          lastName: "Hacker",
          dateOfBirth: "1995-01-01",
          gender: "female",
          phone: `555-0404-${Date.now()}`,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    test("Admin cannot create patient profiles (403)", async () => {
      const res = await request(app)
        .post("/api/patients")
        .set("Authorization", admin.authHeader)
        .send({
          doctor: doctorA._id.toString(),
          firstName: "AdminCreated",
          lastName: "Patient",
          dateOfBirth: "1980-01-01",
          gender: "male",
          phone: `555-0505-${Date.now()}`,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    test("Doctor cannot create patient profiles (403)", async () => {
      const res = await request(app)
        .post("/api/patients")
        .set("Authorization", doctorUserA.authHeader)
        .send({
          doctor: doctorA._id.toString(),
          firstName: "DoctorCreated",
          lastName: "Patient",
          dateOfBirth: "1980-01-01",
          gender: "male",
          phone: `555-0606-${Date.now()}`,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });
  });

  describe("2. Patient Visibility & Scoping", () => {
    test("Receptionist A only sees patients of Doctor A in list", async () => {
      const res = await request(app)
        .get("/api/patients")
        .set("Authorization", receptionistA.authHeader);

      expect(res.status).toBe(200);
      const patientIds = res.body.data.map((p) => p._id);
      expect(patientIds).toContain(patientA._id.toString());
      expect(patientIds).not.toContain(patientB._id.toString());
    });

    test("Doctor A only sees patients of Doctor A in list", async () => {
      const res = await request(app)
        .get("/api/patients")
        .set("Authorization", doctorUserA.authHeader);

      expect(res.status).toBe(200);
      const patientIds = res.body.data.map((p) => p._id);
      expect(patientIds).toContain(patientA._id.toString());
      expect(patientIds).not.toContain(patientB._id.toString());
    });

    test("Admin can see patients across all clinics in list", async () => {
      const res = await request(app)
        .get("/api/patients")
        .set("Authorization", admin.authHeader);

      expect(res.status).toBe(200);
      const patientIds = res.body.data.map((p) => p._id);
      expect(patientIds).toContain(patientA._id.toString());
      expect(patientIds).toContain(patientB._id.toString());
    });

    test("Receptionist A is denied reading Patient B details (403)", async () => {
      const res = await request(app)
        .get(`/api/patients/${patientB._id}`)
        .set("Authorization", receptionistA.authHeader);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    test("Doctor A is denied reading Patient B details (403)", async () => {
      const res = await request(app)
        .get(`/api/patients/${patientB._id}`)
        .set("Authorization", doctorUserA.authHeader);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });
  });

  describe("3. Cross-Clinic Appointment & Resource Isolation", () => {
    test("Rejects booking appointment for Patient A with Doctor B (PATIENT_DOCTOR_MISMATCH)", async () => {
      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", receptionistB.authHeader)
        .send({
          patient: patientA._id.toString(), // belongs to Doctor A
          doctor: doctorB._id.toString(),   // belongs to Doctor B
          appointmentDate: scheduleDateB.toISOString(),
          duration: 30,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("PATIENT_DOCTOR_MISMATCH");
    });

    test("Receptionist A cannot book appointment with Doctor B (403)", async () => {
      const res = await request(app)
        .post("/api/appointments")
        .set("Authorization", receptionistA.authHeader)
        .send({
          patient: patientA._id.toString(),
          doctor: doctorB._id.toString(),
          appointmentDate: scheduleDateB.toISOString(),
          duration: 30,
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });
  });

  describe("4. Medical Records & Clinical Role Boundaries", () => {
    let appointmentA;

    beforeEach(async () => {
      appointmentA = await Appointment.create({
        patient: patientA._id,
        doctor: doctorA._id,
        appointmentDate: scheduleDateA,
        duration: 30,
        status: "confirmed",
        createdBy: receptionistA.user._id,
      });
    });

    test("Receptionist cannot create a clinical visit (403)", async () => {
      const res = await request(app)
        .post("/api/visits")
        .set("Authorization", receptionistA.authHeader)
        .send({
          appointment: appointmentA._id.toString(),
          patient: patientA._id.toString(),
          doctor: doctorA._id.toString(),
          chiefComplaint: "Unauthorized visit",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    test("Doctor B cannot create a visit for Doctor A's appointment (403)", async () => {
      const res = await request(app)
        .post("/api/visits")
        .set("Authorization", doctorUserB.authHeader)
        .send({
          appointment: appointmentA._id.toString(),
          patient: patientA._id.toString(),
          doctor: doctorA._id.toString(),
          chiefComplaint: "Doctor B intrusion",
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    test("Doctor A can successfully create a visit for own clinic", async () => {
      const res = await request(app)
        .post("/api/visits")
        .set("Authorization", doctorUserA.authHeader)
        .send({
          appointment: appointmentA._id.toString(),
          patient: patientA._id.toString(),
          doctor: doctorA._id.toString(),
          chiefComplaint: "Valid clinical visit",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.doctor.toString()).toBe(doctorA._id.toString());
    });
  });

  describe("5. Assignment Revocation & Dynamic Authorization", () => {
    test("Immediately revoking assignment denies Receptionist A access to Doctor A's patients", async () => {
      // 1. Deactivate assignment
      await DoctorAssignment.updateOne(
        { receptionist: receptionistA.user._id, doctor: doctorA._id },
        { isActive: false }
      );

      // 2. Try to view patientA
      const res = await request(app)
        .get(`/api/patients/${patientA._id}`)
        .set("Authorization", receptionistA.authHeader);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");

      // 3. Try to create patient under Doctor A
      const createRes = await request(app)
        .post("/api/patients")
        .set("Authorization", receptionistA.authHeader)
        .send({
          doctor: doctorA._id.toString(),
          firstName: "After",
          lastName: "Revocation",
          dateOfBirth: "1991-01-01",
          gender: "female",
          phone: `555-0707-${Date.now()}`,
        });

      expect(createRes.status).toBe(403);
      expect(createRes.body.code).toBe("FORBIDDEN");
    });
  });

  describe("6. Doctor Assignment Management API", () => {
    test("Receptionist cannot assign themselves or others to doctors (403)", async () => {
      const res = await request(app)
        .post("/api/doctor-assignments")
        .set("Authorization", receptionistA.authHeader)
        .send({
          doctor: doctorB._id.toString(),
          receptionist: receptionistA.user._id.toString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    test("Admin can assign Receptionist A to Doctor B", async () => {
      const res = await request(app)
        .post("/api/doctor-assignments")
        .set("Authorization", admin.authHeader)
        .send({
          doctor: doctorB._id.toString(),
          receptionist: receptionistA.user._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.doctor._id.toString()).toBe(doctorB._id.toString());

      // Now Receptionist A should be able to view Patient B
      const viewRes = await request(app)
        .get(`/api/patients/${patientB._id}`)
        .set("Authorization", receptionistA.authHeader);

      expect(viewRes.status).toBe(200);
      expect(viewRes.body.data._id).toBe(patientB._id.toString());
    });

    test("Receptionist can query their assigned doctors via /my-doctors", async () => {
      const res = await request(app)
        .get("/api/doctor-assignments/my-doctors")
        .set("Authorization", receptionistA.authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]._id).toBe(doctorA._id.toString());
    });
  });
});
