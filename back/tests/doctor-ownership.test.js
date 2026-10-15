const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");
const LabOrder = require("../modules/LabOrder/labOrder.model");
const PerformedService = require("../modules/performedService/performedService.model");
const Schedule = require("../modules/Schedule/schedule.model");
const Visit = require("../modules/Visit/visit.model");
const Appointment = require("../modules/Appointment/appointment.model");
const MedicalAttachment = require("../modules/medicalAttachment/medicalAttachment.model");
const MedicalService = require("../modules/medicalService/medicalService.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
  getFutureAppointmentDate,
} = require("./testHelper");

describe("Doctor resource ownership", () => {
  let admin;
  let doctorUser;
  let doctor;
  let otherDoctor;
  let patient;

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
    patient = await createTestPatient(admin.user);
    ({ doctor, doctorUser } = await createTestDoctor(admin.user));
    ({ doctor: otherDoctor } = await createTestDoctor(admin.user));
  });

  test("restricts lab order reads and updates to the assigned doctor", async () => {
    const labOrder = await LabOrder.create({
      visit: new mongoose.Types.ObjectId(),
      patient: patient._id,
      doctor: otherDoctor._id,
      tests: [{ name: "Blood count", code: "CBC" }],
      createdBy: admin.user._id,
    });

    const read = await request(app)
      .get(`/api/lab-orders/${labOrder._id}`)
      .set("Authorization", doctorUser.authHeader);
    const update = await request(app)
      .patch(`/api/lab-orders/${labOrder._id}`)
      .set("Authorization", doctorUser.authHeader)
      .send({ notes: "Unauthorized change" });

    expect(read.status).toBe(404);
    expect(update.status).toBe(404);
    expect((await LabOrder.findById(labOrder._id)).notes).toBeUndefined();
  });

  test("prevents doctors from creating lab orders for another doctor's visit", async () => {
    const visit = await Visit.create({
      appointment: new mongoose.Types.ObjectId(),
      patient: patient._id,
      doctor: otherDoctor._id,
      chiefComplaint: "Consultation",
      createdBy: admin.user._id,
    });

    const response = await request(app)
      .post("/api/lab-orders")
      .set("Authorization", doctorUser.authHeader)
      .send({
        visit: visit._id.toString(),
        patient: patient._id.toString(),
        doctor: otherDoctor._id.toString(),
        tests: [{ name: "Blood count", code: "CBC" }],
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
    expect(await LabOrder.countDocuments()).toBe(0);
  });

  test("restricts performed-service reads and updates to the assigned doctor", async () => {
    const performedService = await PerformedService.create({
      visit: new mongoose.Types.ObjectId(),
      patient: patient._id,
      doctor: otherDoctor._id,
      service: new mongoose.Types.ObjectId(),
      serviceName: "Consultation",
      serviceCode: "CONSULT",
      price: 100,
      quantity: 1,
      discount: 0,
      createdBy: admin.user._id,
    });

    const read = await request(app)
      .get(`/api/performed-services/${performedService._id}`)
      .set("Authorization", doctorUser.authHeader);
    const update = await request(app)
      .patch(`/api/performed-services/${performedService._id}`)
      .set("Authorization", doctorUser.authHeader)
      .send({ quantity: 5 });

    expect(read.status).toBe(404);
    expect(update.status).toBe(404);
    expect((await PerformedService.findById(performedService._id)).quantity).toBe(1);
  });

  test("prevents doctors from creating performed services for another doctor's visit", async () => {
    const visit = await Visit.create({
      appointment: new mongoose.Types.ObjectId(),
      patient: patient._id,
      doctor: otherDoctor._id,
      chiefComplaint: "Consultation",
      createdBy: admin.user._id,
    });
    const service = await MedicalService.create({
      name: "Consultation",
      code: `CONSULT-${Date.now()}`,
      category: "Consultation",
      price: 100,
      duration: 30,
      createdBy: admin.user._id,
    });

    const response = await request(app)
      .post("/api/performed-services")
      .set("Authorization", doctorUser.authHeader)
      .send({
        visit: visit._id.toString(),
        patient: patient._id.toString(),
        doctor: otherDoctor._id.toString(),
        service: service._id.toString(),
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
    expect(await PerformedService.countDocuments()).toBe(0);
  });

  test("does not grant attachment access based on an appointment without a visit", async () => {
    await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      appointmentDate: getFutureAppointmentDate(),
      duration: 30,
      createdBy: admin.user._id,
    });
    const attachment = await MedicalAttachment.create({
      patient: patient._id,
      type: "medical_report",
      title: "Private medical report",
      file: {
        url: "https://example.com/report.pdf",
        publicId: "test-report",
        originalName: "report.pdf",
        mimeType: "application/pdf",
        size: 128,
      },
      uploadedBy: admin.user._id,
    });

    const response = await request(app)
      .get(`/api/medical-attachments/${attachment._id}`)
      .set("Authorization", doctorUser.authHeader);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  test("restricts schedule details to the assigned doctor", async () => {
    const schedule = await Schedule.create({
      doctor: otherDoctor._id,
      dayOfWeek: 0,
      startTime: "09:00",
      endTime: "17:00",
      createdBy: admin.user._id,
    });

    const response = await request(app)
      .get(`/api/schedules/${schedule._id}`)
      .set("Authorization", doctorUser.authHeader);

    expect(response.status).toBe(404);
  });

  test("allows doctors to create schedules for their own profile without a doctor ID", async () => {
    const response = await request(app)
      .post("/api/schedules")
      .set("Authorization", doctorUser.authHeader)
      .send({
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.doctor).toBe(doctor._id.toString());
  });

  test("prevents doctors from creating or changing another doctor's schedule", async () => {
    const createResponse = await request(app)
      .post("/api/schedules")
      .set("Authorization", doctorUser.authHeader)
      .send({
        doctor: otherDoctor._id.toString(),
        dayOfWeek: 2,
        startTime: "09:00",
        endTime: "17:00",
      });
    const schedule = await Schedule.create({
      doctor: otherDoctor._id,
      dayOfWeek: 3,
      startTime: "09:00",
      endTime: "17:00",
      createdBy: admin.user._id,
    });
    const updateResponse = await request(app)
      .patch(`/api/schedules/${schedule._id}`)
      .set("Authorization", doctorUser.authHeader)
      .send({ startTime: "10:00" });

    expect(createResponse.status).toBe(403);
    expect(createResponse.body.code).toBe("FORBIDDEN");
    expect(updateResponse.status).toBe(404);
    expect((await Schedule.findById(schedule._id)).startTime).toBe("09:00");
  });
});
