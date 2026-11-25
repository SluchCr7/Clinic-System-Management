const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const Appointment = require("../modules/Appointment/appointment.model");
const Visit = require("../modules/Visit/visit.model");
const Invoice = require("../modules/Invoice/invoice.model");
const MedicalService = require("../modules/medicalService/medicalService.model");
const DoctorAssignment = require("../modules/DoctorAssignment/doctorAssignment.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
  assignTestDoctor,
  getFutureAppointmentDate,
} = require("./testHelper");

describe("Search RBAC Scoping Suite", () => {
  let admin;
  let doctorA, doctorUserA;
  let doctorB, doctorUserB;
  let receptionistAssigned, receptionistUserAssigned;
  let receptionistUnassigned;
  let patientA, patientB;
  let appointmentA, appointmentB;
  let visitA, visitB;

  beforeEach(async () => {
    // 1. Admin
    admin = await createTestUser({ role: "admin", firstName: "Super", lastName: "Admin" });

    // 2. Doctor A & Doctor B
    ({ doctor: doctorA, doctorUser: doctorUserA } = await createTestDoctor(admin.user));
    ({ doctor: doctorB, doctorUser: doctorUserB } = await createTestDoctor(admin.user));

    // Update first/last names for deterministic search
    doctorUserA.user.firstName = "Ahmed";
    doctorUserA.user.lastName = "Cardio";
    await doctorUserA.user.save();

    doctorUserB.user.firstName = "Bassem";
    doctorUserB.user.lastName = "Neuro";
    await doctorUserB.user.save();

    // 3. Receptionist assigned to Doctor A only
    receptionistUserAssigned = await createTestUser({
      role: "receptionist",
      firstName: "Rana",
      lastName: "Receptionist",
      phone: "01009998881",
    });
    await assignTestDoctor(receptionistUserAssigned.user, doctorA, admin.user);

    // 4. Receptionist unassigned to any doctor
    receptionistUnassigned = await createTestUser({
      role: "receptionist",
      firstName: "Hoda",
      lastName: "Unassigned",
      phone: "01009998882",
    });

    // 5. Patient A belongs to Doctor A, Patient B belongs to Doctor B
    patientA = await createTestPatient(admin.user, {
      firstName: "Kareem",
      lastName: "PatientA",
      phone: "01011112222",
      doctor: doctorA._id,
    });

    patientB = await createTestPatient(admin.user, {
      firstName: "Nader",
      lastName: "PatientB",
      phone: "01033334444",
      doctor: doctorB._id,
    });

    // 6. Appointments
    const apptDateA = getFutureAppointmentDate(2);
    appointmentA = await Appointment.create({
      patient: patientA._id,
      doctor: doctorA._id,
      appointmentDate: apptDateA,
      duration: 30,
      reason: "Cardiac checkup urgent",
      status: "scheduled",
      createdBy: admin.user._id,
    });

    const apptDateB = getFutureAppointmentDate(3);
    appointmentB = await Appointment.create({
      patient: patientB._id,
      doctor: doctorB._id,
      appointmentDate: apptDateB,
      duration: 30,
      reason: "Neurology consultation",
      status: "scheduled",
      createdBy: admin.user._id,
    });

    // 7. Visits (Medical records)
    visitA = await Visit.create({
      appointment: appointmentA._id,
      patient: patientA._id,
      doctor: doctorA._id,
      chiefComplaint: "Severe chest palpitations",
      diagnosis: ["Hypertension stage 2"],
      doctorNotes: "Prescribed beta blockers",
      status: "completed",
      startedAt: new Date(),
      createdBy: doctorUserA.user._id,
    });

    visitB = await Visit.create({
      appointment: appointmentB._id,
      patient: patientB._id,
      doctor: doctorB._id,
      chiefComplaint: "Chronic migraine attacks",
      diagnosis: ["Migraine with aura"],
      doctorNotes: "Brain MRI requested",
      status: "completed",
      startedAt: new Date(),
      createdBy: doctorUserB.user._id,
    });
  });

  // TEST 1: Doctor searches for their own patient -> Appears
  test("Doctor searching for their own patient finds them", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "Kareem" })
      .set("Authorization", doctorUserA.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.patients).toHaveLength(1);
    expect(res.body.data.results.patients[0].id).toBe(patientA._id.toString());
    expect(res.body.data.results.patients[0].title).toContain("Kareem");
  });

  // TEST 2: Doctor searches for another doctor's patient -> 0 results (no leak)
  test("Doctor searching for another doctor's patient gets zero results", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "Nader" })
      .set("Authorization", doctorUserA.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.patients).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  // TEST 3: Receptionist searches for patient of their assigned doctor -> Appears
  test("Receptionist searching for their assigned doctor's patient finds them", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "Kareem" })
      .set("Authorization", receptionistUserAssigned.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.patients).toHaveLength(1);
    expect(res.body.data.results.patients[0].id).toBe(patientA._id.toString());
  });

  // TEST 4: Receptionist searches for patient of another doctor -> 0 results
  test("Receptionist searching for another doctor's patient gets zero results", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "Nader" })
      .set("Authorization", receptionistUserAssigned.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.patients).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  // TEST 5: Receptionist searches for a doctor NOT assigned to them -> 0 results
  test("Receptionist searching for an unassigned doctor does not see them", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "Bassem" }) // Doctor B
      .set("Authorization", receptionistUserAssigned.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.doctors).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  // TEST 6: Receptionist searches for their assigned doctor -> Appears
  test("Receptionist searching for their assigned doctor sees them", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "Ahmed" }) // Doctor A
      .set("Authorization", receptionistUserAssigned.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.doctors).toHaveLength(1);
    expect(res.body.data.results.doctors[0].id).toBe(doctorA._id.toString());
  });

  // TEST 7: Receptionist searches for another receptionist -> 0 results (forbidden)
  test("Receptionist searching for another receptionist gets zero results", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "Hoda" })
      .set("Authorization", receptionistUserAssigned.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.receptionists).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  // TEST 8: Doctor searches for another doctor -> 0 results (forbidden)
  test("Doctor searching for another doctor gets zero results", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "Bassem" })
      .set("Authorization", doctorUserA.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.doctors).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  // TEST 9: Doctor searches for a receptionist -> 0 results (forbidden)
  test("Doctor searching for a receptionist gets zero results", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "Rana" })
      .set("Authorization", doctorUserA.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.receptionists).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  // TEST 10: Admin searches for anything -> Appears without restrictions
  test("Admin searching can find all doctors, patients, receptionists, appointments, and visits", async () => {
    // Search Doctor A
    const resDoc = await request(app)
      .get("/api/search")
      .query({ q: "Ahmed" })
      .set("Authorization", admin.authHeader);
    expect(resDoc.body.data.results.doctors).toHaveLength(1);

    // Search Doctor B
    const resDocB = await request(app)
      .get("/api/search")
      .query({ q: "Bassem" })
      .set("Authorization", admin.authHeader);
    expect(resDocB.body.data.results.doctors).toHaveLength(1);

    // Search Receptionist
    const resRec = await request(app)
      .get("/api/search")
      .query({ q: "Rana" })
      .set("Authorization", admin.authHeader);
    expect(resRec.body.data.results.receptionists).toHaveLength(1);
    expect(resRec.body.data.results.receptionists[0].title).toContain("Rana");

    // Search Patient B
    const resPatientB = await request(app)
      .get("/api/search")
      .query({ q: "Nader" })
      .set("Authorization", admin.authHeader);
    expect(resPatientB.body.data.results.patients).toHaveLength(1);
  });

  // TEST 11: Unassigned receptionist gets zero results across all resources
  test("Unassigned receptionist receives empty search results silently", async () => {
    const res = await request(app)
      .get("/api/search")
      .query({ q: "Kareem" })
      .set("Authorization", receptionistUnassigned.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.results.patients).toHaveLength(0);
  });

  // TEST 12: Searching by phone number respects RBAC scope
  test("Searching by patient phone number respects RBAC scope", async () => {
    // Doctor A searches by Patient A's phone
    const resA = await request(app)
      .get("/api/search")
      .query({ q: "01011112222" })
      .set("Authorization", doctorUserA.authHeader);
    expect(resA.body.data.results.patients).toHaveLength(1);

    // Doctor A searches by Patient B's phone -> 0 results
    const resB = await request(app)
      .get("/api/search")
      .query({ q: "01033334444" })
      .set("Authorization", doctorUserA.authHeader);
    expect(resB.body.data.results.patients).toHaveLength(0);
  });

  // TEST 13: Searching clinical visits/records respects RBAC scope
  test("Doctor and assigned Receptionist can search medical visits within their scope", async () => {
    // Doctor A searches for diagnosis "Hypertension"
    const resDoc = await request(app)
      .get("/api/search")
      .query({ q: "Hypertension" })
      .set("Authorization", doctorUserA.authHeader);
    expect(resDoc.body.data.results.visits).toHaveLength(1);
    expect(resDoc.body.data.results.visits[0].id).toBe(visitA._id.toString());

    // Doctor A searches for Doctor B's diagnosis "Migraine" -> 0 results
    const resDocOther = await request(app)
      .get("/api/search")
      .query({ q: "Migraine" })
      .set("Authorization", doctorUserA.authHeader);
    expect(resDocOther.body.data.results.visits).toHaveLength(0);

    // Receptionist assigned to Doctor A searches for "palpitations" -> finds visitA
    const resRec = await request(app)
      .get("/api/search")
      .query({ q: "palpitations" })
      .set("Authorization", receptionistUserAssigned.authHeader);
    expect(resRec.body.data.results.visits).toHaveLength(1);
    expect(resRec.body.data.results.visits[0].id).toBe(visitA._id.toString());
  });
});
