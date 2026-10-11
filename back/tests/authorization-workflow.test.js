const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const Appointment = require("../modules/Appointment/appointment.model");
const Visit = require("../modules/Visit/visit.model");
const LabOrder = require("../modules/LabOrder/labOrder.model");
const Patient = require("../modules/Patient/patient.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
  createTestSchedule,
  getFutureAppointmentDate,
} = require("./testHelper");

describe("Authorization and Clinical Workflow Integrity API", () => {
  let admin;
  let receptionist;
  let doctorUser;
  let doctorRecord;
  let otherDoctorUser;
  let otherDoctorRecord;
  let patient;
  let appointmentDate;
  let appointment;

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
    receptionist = await createTestUser({ role: "receptionist" });
    ({ doctorUser, doctor: doctorRecord } = await createTestDoctor(admin.user));
    ({ doctorUser: otherDoctorUser, doctor: otherDoctorRecord } =
      await createTestDoctor(admin.user));
    patient = await createTestPatient(admin.user);

    appointmentDate = getFutureAppointmentDate(2);
    await createTestSchedule(doctorRecord, admin.user, appointmentDate);

    appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctorRecord._id,
      appointmentDate,
      duration: 30,
      status: "scheduled",
      reason: "General consultation",
      createdBy: receptionist.user._id,
    });
  });

  describe("Role-Based Access Boundaries: Receptionist Clinical Access", () => {
    test("strictly denies receptionist from listing clinical visits (403)", async () => {
      const response = await request(app)
        .get("/api/visits")
        .set("Authorization", receptionist.authHeader);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
    });

    test("strictly denies receptionist from reading specific visit clinical details (403)", async () => {
      const visit = await Visit.create({
        appointment: appointment._id,
        patient: patient._id,
        doctor: doctorRecord._id,
        chiefComplaint: "Severe headache",
        diagnosis: ["Migraine"],
        doctorNotes: "Confidential clinical examination notes",
        createdBy: doctorUser.user._id,
      });

      const response = await request(app)
        .get(`/api/visits/${visit._id}`)
        .set("Authorization", receptionist.authHeader);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
    });

    test("strictly denies receptionist from listing or reading lab orders (403)", async () => {
      const labOrder = await LabOrder.create({
        visit: new mongoose.Types.ObjectId(),
        patient: patient._id,
        doctor: doctorRecord._id,
        tests: [{ name: "Complete Blood Count", code: "CBC" }],
        createdBy: doctorUser.user._id,
      });

      const listResponse = await request(app)
        .get("/api/lab-orders")
        .set("Authorization", receptionist.authHeader);

      const detailResponse = await request(app)
        .get(`/api/lab-orders/${labOrder._id}`)
        .set("Authorization", receptionist.authHeader);

      expect(listResponse.status).toBe(403);
      expect(listResponse.body.code).toBe("FORBIDDEN");
      expect(detailResponse.status).toBe(403);
      expect(detailResponse.body.code).toBe("FORBIDDEN");
    });
  });

  describe("Doctor Resource Scoping & IDOR Prevention", () => {
    test("prevents a doctor from accessing another doctor's clinical visit (404 without leaking)", async () => {
      const visit = await Visit.create({
        appointment: appointment._id,
        patient: patient._id,
        doctor: doctorRecord._id,
        chiefComplaint: "Abdominal pain",
        diagnosis: ["Gastritis"],
        doctorNotes: "Doctor A notes",
        createdBy: doctorUser.user._id,
      });

      // Other doctor attempts to read Doctor A's visit
      const response = await request(app)
        .get(`/api/visits/${visit._id}`)
        .set("Authorization", otherDoctorUser.authHeader);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe("VISIT_NOT_FOUND");
    });

    test("prevents a doctor from updating another doctor's clinical visit", async () => {
      const visit = await Visit.create({
        appointment: appointment._id,
        patient: patient._id,
        doctor: doctorRecord._id,
        chiefComplaint: "Ear ache",
        diagnosis: ["Otitis media"],
        createdBy: doctorUser.user._id,
      });

      const response = await request(app)
        .patch(`/api/visits/${visit._id}`)
        .set("Authorization", otherDoctorUser.authHeader)
        .send({ doctorNotes: "Tampered notes by another doctor" });

      expect(response.status).toBe(404);
      const unchanged = await Visit.findById(visit._id);
      expect(unchanged.doctorNotes).toBeUndefined();
    });
  });

  describe("Clinical Workflow: Appointments and Visits", () => {
    test("creates a visit, verifies relationship, and transitions appointment to completed", async () => {
      const visitPayload = {
        appointment: appointment._id.toString(),
        patient: patient._id.toString(),
        doctor: doctorRecord._id.toString(),
        chiefComplaint: "Persistent dry cough",
        symptoms: ["Cough", "Mild fever"],
        diagnosis: ["Acute bronchitis"],
        doctorNotes: "Prescribed bronchodilator and fluids",
      };

      const response = await request(app)
        .post("/api/visits")
        .set("Authorization", doctorUser.authHeader)
        .send(visitPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.chiefComplaint).toBe("Persistent dry cough");

      // Verify that the appointment automatically transitioned to completed
      const updatedAppointment = await Appointment.findById(appointment._id);
      expect(updatedAppointment.status).toBe("completed");
    });

    test("prevents creating a second visit for the same appointment", async () => {
      await Visit.create({
        appointment: appointment._id,
        patient: patient._id,
        doctor: doctorRecord._id,
        chiefComplaint: "Initial visit",
        createdBy: doctorUser.user._id,
      });

      const response = await request(app)
        .post("/api/visits")
        .set("Authorization", doctorUser.authHeader)
        .send({
          appointment: appointment._id.toString(),
          patient: patient._id.toString(),
          doctor: doctorRecord._id.toString(),
          chiefComplaint: "Duplicate visit attempt",
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe("VISIT_ALREADY_EXISTS");
    });

    test("prevents a doctor from creating a visit for another doctor's appointment", async () => {
      const response = await request(app)
        .post("/api/visits")
        .set("Authorization", otherDoctorUser.authHeader)
        .send({
          appointment: appointment._id.toString(),
          patient: patient._id.toString(),
          doctor: doctorRecord._id.toString(),
          chiefComplaint: "Attempting to hijack appointment",
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
    });
  });

  describe("Mass Assignment & Privilege Escalation Prevention", () => {
    test("prevents updating protected internal fields on patients", async () => {
      const rogueId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .patch(`/api/patients/${patient._id}`)
        .set("Authorization", receptionist.authHeader)
        .send({
          phone: "555-updated-phone-99",
          createdBy: rogueId.toString(),
          updatedBy: rogueId.toString(),
          _id: rogueId.toString(),
        });

      expect(response.status).toBe(200);
      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient.phone).toBe("555-updated-phone-99");
      // createdBy must remain the original creator, not overwritten by payload
      expect(updatedPatient.createdBy.toString()).toBe(admin.user._id.toString());
    });

    test("prevents reassigning doctor or patient on appointment update", async () => {
      const fakePatientId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .patch(`/api/appointments/${appointment._id}`)
        .set("Authorization", receptionist.authHeader)
        .send({
          reason: "Updated checkup reason",
          patient: fakePatientId.toString(),
          doctor: otherDoctorRecord._id.toString(),
        });

      expect(response.status).toBe(200);
      const updatedAppointment = await Appointment.findById(appointment._id);
      expect(updatedAppointment.reason).toBe("Updated checkup reason");
      expect(updatedAppointment.patient.toString()).toBe(patient._id.toString());
      expect(updatedAppointment.doctor.toString()).toBe(doctorRecord._id.toString());
    });
  });
});
