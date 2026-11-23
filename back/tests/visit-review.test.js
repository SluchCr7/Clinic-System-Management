const request = require("supertest");
const app = require("../index");
const Appointment = require("../modules/Appointment/appointment.model");
const Visit = require("../modules/Visit/visit.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
  assignTestDoctor,
  createTestSchedule,
  getFutureAppointmentDate,
} = require("./testHelper");

describe("Visit Review and Availability Fix API", () => {
  let admin;
  let receptionist;
  let doctorUser;
  let doctor;
  let patient;
  let appointmentDate;
  let checkedInAppointment;

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
    receptionist = await createTestUser({ role: "receptionist" });
    ({ doctor, doctorUser } = await createTestDoctor(admin.user));
    await assignTestDoctor(receptionist.user, doctor, admin.user);
    patient = await createTestPatient(receptionist.user, { doctor: doctor._id });
    appointmentDate = getFutureAppointmentDate(1);
    await createTestSchedule(doctor, receptionist.user, appointmentDate);

    checkedInAppointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      appointmentDate,
      duration: 30,
      status: "checked_in",
      createdBy: receptionist.user._id,
    });
  });

  test("submits visit without errors when doctor has future scheduled appointments (no false conflict)", async () => {
    // Another appointment scheduled for tomorrow or later
    const futureDate = new Date(appointmentDate.getTime() + 2 * 60 * 60 * 1000);
    const secondPatient = await createTestPatient(receptionist.user, { doctor: doctor._id });
    await Appointment.create({
      patient: secondPatient._id,
      doctor: doctor._id,
      appointmentDate: futureDate,
      duration: 30,
      status: "scheduled",
      createdBy: receptionist.user._id,
    });

    const res = await request(app)
      .post("/api/visits")
      .set("Authorization", doctorUser.authHeader)
      .send({
        appointment: checkedInAppointment._id.toString(),
        patient: patient._id.toString(),
        doctor: doctor._id.toString(),
        chiefComplaint: "Sore throat and headache",
        diagnosis: ["Acute viral pharyngitis"],
        doctorNotes: "Rest and hydration recommended",
        followUpDate: null,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("in_progress");
  });

  test("submits visit with no review appointment smoothly without errors", async () => {
    const res = await request(app)
      .post("/api/visits")
      .set("Authorization", doctorUser.authHeader)
      .send({
        appointment: checkedInAppointment._id.toString(),
        patient: patient._id.toString(),
        doctor: doctor._id.toString(),
        chiefComplaint: "Routine follow-up",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.followUpDate).toBeNull();
  });

  test("books a review appointment during visit creation when bookFollowUp is true and doctor is available", async () => {
    const reviewDate = getFutureAppointmentDate(5);
    await createTestSchedule(doctor, receptionist.user, reviewDate);

    const res = await request(app)
      .post("/api/visits")
      .set("Authorization", doctorUser.authHeader)
      .send({
        appointment: checkedInAppointment._id.toString(),
        patient: patient._id.toString(),
        doctor: doctor._id.toString(),
        chiefComplaint: "Follow-up required in 5 days",
        followUpDate: reviewDate.toISOString(),
        followUpReason: "Check antibiotic response",
        bookFollowUp: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const bookedAppt = await Appointment.findOne({ originatingVisit: res.body.data._id });
    expect(bookedAppt).not.toBeNull();
    expect(bookedAppt.isFollowUp).toBe(true);
    expect(bookedAppt.followUpOf.toString()).toBe(checkedInAppointment._id.toString());
    expect(bookedAppt.status).toBe("scheduled");
  });

  test("rejects booking review appointment if doctor already has an appointment during that specific time", async () => {
    const reviewDate = getFutureAppointmentDate(5);
    await createTestSchedule(doctor, receptionist.user, reviewDate);

    // Create an existing conflicting appointment on that day and hour
    const otherPatient = await createTestPatient(receptionist.user, { doctor: doctor._id });
    await Appointment.create({
      patient: otherPatient._id,
      doctor: doctor._id,
      appointmentDate: reviewDate,
      duration: 30,
      status: "scheduled",
      createdBy: receptionist.user._id,
    });

    const res = await request(app)
      .post("/api/visits")
      .set("Authorization", doctorUser.authHeader)
      .send({
        appointment: checkedInAppointment._id.toString(),
        patient: patient._id.toString(),
        doctor: doctor._id.toString(),
        chiefComplaint: "Need review in 5 days",
        followUpDate: reviewDate.toISOString(),
        bookFollowUp: true,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("APPOINTMENT_CONFLICT");
    expect(res.body.message).toBe("Doctor already has an appointment during this time");
  });

  test("allows booking follow-up appointment while visit is in_progress", async () => {
    const visitRes = await request(app)
      .post("/api/visits")
      .set("Authorization", doctorUser.authHeader)
      .send({
        appointment: checkedInAppointment._id.toString(),
        patient: patient._id.toString(),
        doctor: doctor._id.toString(),
        chiefComplaint: "Chest checkup",
      });
    expect(visitRes.status).toBe(201);
    const visitId = visitRes.body.data._id;

    const followUpDate = getFutureAppointmentDate(7);
    await createTestSchedule(doctor, receptionist.user, followUpDate);

    const bookRes = await request(app)
      .post("/api/appointments")
      .set("Authorization", doctorUser.authHeader)
      .send({
        patient: patient._id.toString(),
        doctor: doctor._id.toString(),
        appointmentDate: followUpDate.toISOString(),
        duration: 30,
        isFollowUp: true,
        originatingVisit: visitId,
        followUpOf: checkedInAppointment._id.toString(),
      });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body.data.isFollowUp).toBe(true);
  });
});
