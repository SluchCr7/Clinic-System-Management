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
  assignTestDoctor,
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
    await assignTestDoctor(receptionist.user, doctorRecord, admin.user);
    patient = await createTestPatient(admin.user, {
      doctor: doctorRecord._id,
    });

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

      expect(listResponse.status).toBe(200);
      expect(detailResponse.status).toBe(403);
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
    test("records a visit while an appointment is in progress and completes it afterward", async () => {
      const confirmResponse = await request(app)
        .patch(`/api/appointments/${appointment._id}`)
        .set("Authorization", admin.authHeader)
        .send({ status: "confirmed" });
      expect(confirmResponse.status).toBe(403);

      const receptionistConfirmResponse = await request(app)
        .patch(`/api/appointments/${appointment._id}`)
        .set("Authorization", receptionist.authHeader)
        .send({ status: "confirmed" });
      expect(receptionistConfirmResponse.status).toBe(200);

      const checkInResponse = await request(app)
        .patch(`/api/appointments/${appointment._id}`)
        .set("Authorization", receptionist.authHeader)
        .send({ status: "checked_in" });
      expect(checkInResponse.status).toBe(200);

      const visitPayload = {
        appointment: appointment._id.toString(),
        patient: patient._id.toString(),
        doctor: doctorRecord._id.toString(),
        chiefComplaint: "Persistent dry cough",
        symptoms: ["Cough", "Mild fever"],
        diagnosis: ["Acute bronchitis"],
        doctorNotes: "Prescribed bronchodilator and fluids",
        followUpDate: getFutureAppointmentDate(10).toISOString(),
        followUpReason: "Review symptoms after treatment",
      };

      const response = await request(app)
        .post("/api/visits")
        .set("Authorization", doctorUser.authHeader)
        .send(visitPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.chiefComplaint).toBe("Persistent dry cough");
      expect(response.body.data.status).toBe("in_progress");
      expect(response.body.data.statusHistory).toHaveLength(1);
      expect(response.body.data.followUpReason).toBe(
        "Review symptoms after treatment"
      );
      expect(
        await Appointment.countDocuments({ originatingVisit: response.body.data._id })
      ).toBe(0);

      const inProgressAppointment = await Appointment.findById(appointment._id);
      expect(inProgressAppointment.status).toBe("in_progress");
      expect(inProgressAppointment.startedBy.toString()).toBe(
        doctorUser.user._id.toString()
      );

      const completeResponse = await request(app)
        .post(`/api/visits/${response.body.data._id}/complete`)
        .set("Authorization", doctorUser.authHeader)
        .send({});
      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.data.status).toBe("completed");
      expect(completeResponse.body.data.completedBy).toBe(
        doctorUser.user._id.toString()
      );

      const completedAppointment = await Appointment.findById(appointment._id);
      expect(completedAppointment.status).toBe("completed");
      expect(completedAppointment.statusHistory.at(-1).to).toBe("completed");

      const statusHistoryLength = completeResponse.body.data.statusHistory.length;
      const repeatedCompletion = await request(app)
        .post(`/api/visits/${response.body.data._id}/complete`)
        .set("Authorization", doctorUser.authHeader)
        .send({});
      expect(repeatedCompletion.status).toBe(200);
      expect(repeatedCompletion.body.data.statusHistory).toHaveLength(
        statusHistoryLength
      );

      const editCompletedVisit = await request(app)
        .patch(`/api/visits/${response.body.data._id}`)
        .set("Authorization", doctorUser.authHeader)
        .send({ doctorNotes: "Late edit" });
      expect(editCompletedVisit.status).toBe(409);
      expect(editCompletedVisit.body.code).toBe("VISIT_NOT_EDITABLE");
    });

    test("does not allow administrators to complete a visit", async () => {
      const visit = await Visit.create({
        appointment: appointment._id,
        patient: patient._id,
        doctor: doctorRecord._id,
        chiefComplaint: "Admin completion authorization",
        createdBy: doctorUser.user._id,
      });

      const response = await request(app)
        .post(`/api/visits/${visit._id}/complete`)
        .set("Authorization", admin.authHeader);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
    });

    test("rejects inconsistent blood pressure before creating a visit", async () => {
      await Appointment.updateOne(
        { _id: appointment._id },
        { $set: { status: "checked_in", checkedInAt: new Date() } }
      );

      const response = await request(app)
        .post("/api/visits")
        .set("Authorization", doctorUser.authHeader)
        .send({
          appointment: appointment._id.toString(),
          patient: patient._id.toString(),
          doctor: doctorRecord._id.toString(),
          chiefComplaint: "Blood pressure validation",
          vitals: { bloodPressure: { systolic: 70, diastolic: 90 } },
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
      expect(await Visit.countDocuments()).toBe(0);
    });

    test("prevents creating a second visit for the same appointment", async () => {
      await Appointment.updateOne(
        { _id: appointment._id },
        { $set: { status: "checked_in", checkedInAt: new Date() } }
      );
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

    test("rejects visit creation for cancelled and no-show appointments", async () => {
      for (const status of ["cancelled", "no-show"]) {
        await Appointment.updateOne({ _id: appointment._id }, { $set: { status } });

        const response = await request(app)
          .post("/api/visits")
          .set("Authorization", doctorUser.authHeader)
          .send({
            appointment: appointment._id.toString(),
            patient: patient._id.toString(),
            doctor: doctorRecord._id.toString(),
            chiefComplaint: `Visit for ${status} appointment`,
          });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe("INVALID_APPOINTMENT_STATUS");
      }

      expect(await Visit.countDocuments()).toBe(0);
    });

    test("allows only one concurrent visit creation for a checked-in appointment", async () => {
      await Appointment.updateOne(
        { _id: appointment._id },
        { $set: { status: "checked_in", checkedInAt: new Date() } }
      );
      const createRequest = () =>
        request(app)
          .post("/api/visits")
          .set("Authorization", doctorUser.authHeader)
          .send({
            appointment: appointment._id.toString(),
            patient: patient._id.toString(),
            doctor: doctorRecord._id.toString(),
            chiefComplaint: "Concurrent visit start",
          });

      const responses = await Promise.all([createRequest(), createRequest()]);

      expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
      expect(await Visit.countDocuments({ appointment: appointment._id })).toBe(1);
      expect((await Appointment.findById(appointment._id)).status).toBe(
        "in_progress"
      );
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
  describe("User Profile Self-Management & Privilege Boundaries", () => {
    test("allows a doctor or receptionist to update their own profile name and phone", async () => {
      const response = await request(app)
        .patch(`/api/users/${doctorUser.user._id}`)
        .set("Authorization", doctorUser.authHeader)
        .send({
          firstName: "UpdatedDrFirst",
          lastName: "UpdatedDrLast",
          phone: "01099988877",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.firstName).toBe("UpdatedDrFirst");
      expect(response.body.data.lastName).toBe("UpdatedDrLast");
    });

    test("strictly rejects non-admin attempts to update another user (403)", async () => {
      const response = await request(app)
        .patch(`/api/users/${admin.user._id}`)
        .set("Authorization", receptionist.authHeader)
        .send({
          firstName: "HackedAdminName",
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
    });

    test("strictly rejects non-admin privilege escalation or status modification (403)", async () => {
      const response = await request(app)
        .patch(`/api/users/${receptionist.user._id}`)
        .set("Authorization", receptionist.authHeader)
        .send({
          role: "admin",
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("FORBIDDEN");
    });
  });
});
