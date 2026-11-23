const request = require("supertest");
const app = require("../index");
const Clinic = require("../modules/Clinic/clinic.model");
const Schedule = require("../modules/Schedule/schedule.model");
const {
  createTestUser,
  createTestDoctor,
  createTestPatient,
} = require("./testHelper");

describe("Doctor Schedule and Clinic Settings Connection", () => {
  let ownerUser;
  let ownerDoctor;
  let clinic;

  beforeEach(async () => {
    const admin = await createTestUser({ role: "admin" });
    ({ doctor: ownerDoctor, doctorUser: ownerUser } =
      await createTestDoctor(admin.user));

    clinic = await Clinic.findById(ownerDoctor.clinic);
    clinic.working_hours = {
      sunday: { open: null, close: null, closed: true, emergency: false },
      monday: { open: "08:00", close: "18:00", closed: false, emergency: false },
      tuesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
      wednesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
      thursday: { open: "08:00", close: "18:00", closed: false, emergency: false },
      friday: { open: "08:00", close: "18:00", closed: false, emergency: false },
      saturday: { open: "09:00", close: "14:00", closed: false, emergency: false },
    };
    await clinic.save();
  });

  test("rejects creating doctor schedule on a closed clinic day", async () => {
    // Sunday is dayOfWeek: 0, which is closed
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", ownerUser.authHeader)
      .send({
        dayOfWeek: 0,
        startTime: "09:00",
        endTime: "17:00",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CLINIC_CLOSED_ON_DAY");
  });

  test("rejects doctor schedule outside clinic operating hours", async () => {
    // Saturday is 09:00 - 14:00
    // Try to schedule doctor 09:00 - 17:00
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", ownerUser.authHeader)
      .send({
        dayOfWeek: 6,
        startTime: "09:00",
        endTime: "17:00",
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SCHEDULE_OUTSIDE_CLINIC_HOURS");
  });

  test("accepts doctor schedule within clinic operating hours", async () => {
    // Monday is 08:00 - 18:00. Doctor schedules 09:00 - 17:00
    const res = await request(app)
      .post("/api/schedules")
      .set("Authorization", ownerUser.authHeader)
      .send({
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.startTime).toBe("09:00");
    expect(res.body.data.endTime).toBe("17:00");
  });

  test("syncs doctor schedule with clinic operating hours via sync-clinic endpoint", async () => {
    const res = await request(app)
      .post("/api/schedules/sync-clinic")
      .set("Authorization", ownerUser.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Monday schedule should exist with 08:00 - 18:00
    const mondaySchedule = await Schedule.findOne({
      doctor: ownerDoctor._id,
      dayOfWeek: 1,
    });
    expect(mondaySchedule).toBeTruthy();
    expect(mondaySchedule.startTime).toBe("08:00");
    expect(mondaySchedule.endTime).toBe("18:00");
    expect(mondaySchedule.isActive).toBe(true);

    // Saturday schedule should exist with 09:00 - 14:00
    const satSchedule = await Schedule.findOne({
      doctor: ownerDoctor._id,
      dayOfWeek: 6,
    });
    expect(satSchedule).toBeTruthy();
    expect(satSchedule.startTime).toBe("09:00");
    expect(satSchedule.endTime).toBe("14:00");
    expect(satSchedule.isActive).toBe(true);
  });

  test("updating clinic working hours automatically synchronizes doctor schedules and deactivates closed days", async () => {
    // Create an active schedule on Monday
    await Schedule.create({
      doctor: ownerDoctor._id,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "18:00",
      isActive: true,
      createdBy: ownerUser.user._id,
    });

    // Now update clinic to mark Monday as closed and Saturday to 09:00 - 12:00
    const updateRes = await request(app)
      .patch("/api/clinics/me")
      .set("Authorization", ownerUser.authHeader)
      .send({
        syncDoctorSchedule: true,
        working_hours: {
          sunday: { open: null, close: null, closed: true, emergency: false },
          monday: { open: null, close: null, closed: true, emergency: false },
          tuesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
          wednesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
          thursday: { open: "08:00", close: "18:00", closed: false, emergency: false },
          friday: { open: "08:00", close: "18:00", closed: false, emergency: false },
          saturday: { open: "09:00", close: "12:00", closed: false, emergency: false },
        },
      });

    expect(updateRes.status).toBe(200);

    // Monday doctor schedule should be deactivated because clinic is closed on Monday!
    const updatedMonday = await Schedule.findOne({
      doctor: ownerDoctor._id,
      dayOfWeek: 1,
    });
    expect(updatedMonday.isActive).toBe(false);
  });
});
