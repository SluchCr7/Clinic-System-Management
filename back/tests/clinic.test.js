const request = require("supertest");
const app = require("../index");
const Clinic = require("../modules/Clinic/clinic.model");
const {
  createTestUser,
  createTestDoctor,
  assignTestDoctor,
} = require("./testHelper");
const { ensureOwnClinicForDoctor } = require("../scripts/migrateClinicData");

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

    clinic = await Clinic.findById(ownerDoctor.clinic);
    clinic.name = "Aegis Precision Clinic";
    clinic.license_number = "MOH-CLN-88319";
    clinic.slot_duration_minutes = 15;
    clinic.currency = "USD";
    clinic.tax_note = "Zero-Rated Clinical Tax";
    clinic.working_hours = {
        sunday: { open: null, close: null, closed: false, emergency: true },
        monday: { open: "08:00", close: "18:00", closed: false, emergency: false },
        tuesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
        wednesday: { open: "08:00", close: "18:00", closed: false, emergency: false },
        thursday: { open: "08:00", close: "18:00", closed: false, emergency: false },
        friday: { open: "08:00", close: "18:00", closed: false, emergency: false },
        saturday: { open: "09:00", close: "14:00", closed: false, emergency: false },
      };
    await clinic.save();
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
    const otherDoctorUser = await createTestUser({ role: "doctor" });

    const response = await request(app)
      .patch("/api/clinics/me")
      .set("Authorization", otherDoctorUser.authHeader)
      .send({ name: "Unauthorized Change" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  test("admin cannot update clinic data", async () => {
    const admin = await createTestUser({ role: "admin" });
    const response = await request(app)
      .patch("/api/clinics/me")
      .set("Authorization", admin.authHeader)
      .send({ name: "Unauthorized Change" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });

  test("migration is idempotent and creates only one clinic per doctor", async () => {
    const admin = await createTestUser({ role: "admin" });
    const { doctor } = await createTestDoctor(admin.user);
    await ensureOwnClinicForDoctor(doctor);
    await ensureOwnClinicForDoctor(doctor);

    const ownedClinics = await Clinic.countDocuments({
      owner_doctor_id: doctor._id,
    });
    expect(ownedClinics).toBe(1);
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
