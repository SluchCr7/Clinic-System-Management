const request = require("supertest");
const app = require("../index");
const Clinic = require("../modules/Clinic/clinic.model");
const {
  createTestUser,
  createTestDoctor,
  assignTestDoctor,
} = require("./testHelper");

describe("Clinic configuration API", () => {
  let ownerUser;
  let ownerDoctor;
  let receptionist;
  let clinic;

  beforeEach(async () => {
    const admin = await createTestUser({ role: "admin" });
    ({ doctor: ownerDoctor, doctorUser: ownerUser } =
      await createTestDoctor(admin.user));
    receptionist = await createTestUser({ role: "receptionist" });

    clinic = await Clinic.create({
      name: "Aegis Precision Clinic",
      license_number: "MOH-CLN-88319",
      slot_duration_minutes: 15,
      currency: "USD",
      tax_note: "Zero-Rated Clinical Tax",
      working_hours: {
        sunday: { open: null, close: null, closed: false, emergency: true },
        monday: { open: "08:00", close: "18:00", closed: false, emergency: false },
        tuesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
        wednesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
        thursday: { open: "08:00", close: "18:00", closed: false, emergency: false },
        friday: { open: "08:00", close: "18:00", closed: false, emergency: false },
        saturday: { open: "09:00", close: "14:00", closed: false, emergency: false },
      },
      owner_doctor_id: ownerDoctor._id,
    });

    ownerDoctor.clinic = clinic._id;
    await ownerDoctor.save();
    receptionist.user.clinic = clinic._id;
    await receptionist.user.save();
    await assignTestDoctor(receptionist.user, ownerDoctor, admin.user);
  });

  test("owner doctor can read and update clinic data", async () => {
    const readResponse = await request(app)
      .get("/api/clinics/me")
      .set("Authorization", ownerUser.authHeader);

    expect(readResponse.status).toBe(200);
    expect(readResponse.body.data.name).toBe("Aegis Precision Clinic");
    expect(readResponse.body.data.license_number).toBe("MOH-CLN-88319");

    const updateResponse = await request(app)
      .patch("/api/clinics/me")
      .set("Authorization", ownerUser.authHeader)
      .send({
        name: "Updated Clinic",
        slot_duration_minutes: 20,
        currency: "EGP",
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe("Updated Clinic");
    expect(updateResponse.body.data.slot_duration_minutes).toBe(20);
  });

  test("assigned staff sees only clinic name and assigned doctor name", async () => {
    const response = await request(app)
      .get("/api/clinics/me")
      .set("Authorization", receptionist.authHeader);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      id: clinic._id.toString(),
      name: "Aegis Precision Clinic",
      doctor: {
        id: ownerDoctor._id.toString(),
        name: "Morgan Doctor",
      },
    });
  });

  test("staff cannot update clinic data", async () => {
    const response = await request(app)
      .patch("/api/clinics/me")
      .set("Authorization", receptionist.authHeader)
      .send({ name: "Unauthorized Change" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  test("doctor from another clinic cannot update clinic data", async () => {
    const admin = await createTestUser({ role: "admin" });
    const { doctorUser: otherDoctorUser } =
      await createTestDoctor(admin.user);

    const response = await request(app)
      .patch("/api/clinics/me")
      .set("Authorization", otherDoctorUser.authHeader)
      .send({ name: "Unauthorized Change" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  test("rejects invalid clinic values", async () => {
    const response = await request(app)
      .patch("/api/clinics/me")
      .set("Authorization", ownerUser.authHeader)
      .send({
        slot_duration_minutes: 0,
        currency: "NOT_A_CURRENCY",
        working_hours: {
          monday: {
            open: "18:00",
            close: "08:00",
            closed: false,
            emergency: false,
          },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});
