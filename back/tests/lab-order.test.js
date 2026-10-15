const request = require("supertest");
const app = require("../index");
const LabOrder = require("../modules/LabOrder/labOrder.model");
const Appointment = require("../modules/Appointment/appointment.model");
const Visit = require("../modules/Visit/visit.model");
const AuditLog = require("../modules/AuditLog/auditLog.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
  getFutureAppointmentDate,
} = require("./testHelper");

describe("Lab orders API", () => {
  let admin;
  let patient;
  let doctor;
  let visit;

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
    patient = await createTestPatient(admin.user);
    ({ doctor } = await createTestDoctor(admin.user));

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      appointmentDate: getFutureAppointmentDate(),
      duration: 30,
      status: "confirmed",
      createdBy: admin.user._id,
    });
    visit = await Visit.create({
      appointment: appointment._id,
      patient: patient._id,
      doctor: doctor._id,
      chiefComplaint: "Routine blood work",
      createdBy: admin.user._id,
    });
  });

  test("allows an ordered lab order to be completed directly", async () => {
    const labOrder = await LabOrder.create({
      visit: visit._id,
      patient: patient._id,
      doctor: doctor._id,
      tests: [{ name: "CBC" }],
      createdBy: admin.user._id,
    });

    const response = await request(app)
      .patch(`/api/lab-orders/${labOrder._id}`)
      .set("Authorization", admin.authHeader)
      .send({ status: "completed" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("completed");
    expect((await LabOrder.findById(labOrder._id)).status).toBe("completed");
    expect(
      await AuditLog.findOne({
        action: "LAB_ORDER_UPDATED",
        resourceId: labOrder._id,
      })
    ).not.toBeNull();
  });
});
