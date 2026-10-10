
const request = require("supertest");
const app = require("../index");
const Doctor = require("../modules/Doctor/doctor.model");
const AuditLog = require("../modules/AuditLog/auditLog.model");
const {
  createTestUser,
  createTestDoctor,
} = require("./testHelper");

describe("Doctors API", () => {
  let admin;

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
  });

  const createDoctorPayload = (userId, overrides = {}) => ({
    user: userId.toString(),
    specialization: "Cardiology",
    licenseNumber: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    consultationFee: 350,
    yearsOfExperience: 8,
    bio: "Experienced cardiologist",
    ...overrides,
  });

  test("allows an administrator to create a doctor profile and records an audit log", async () => {
    const doctorUser = await createTestUser({
      role: "doctor",
      firstName: "Mona",
      lastName: "Hassan",
    });

    const payload = createDoctorPayload(doctorUser.user._id);

    const response = await request(app)
      .post("/api/doctors")
      .set("Authorization", admin.authHeader)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.toString()).toBe(
      doctorUser.user._id.toString()
    );
    expect(response.body.data.specialization).toBe("Cardiology");
    expect(response.body.data.consultationFee).toBe(350);

    const savedDoctor = await Doctor.findById(response.body.data._id);

    expect(savedDoctor).not.toBeNull();
    expect(savedDoctor.createdBy.toString()).toBe(
      admin.user._id.toString()
    );

    const auditLog = await AuditLog.findOne({
      action: "DOCTOR_CREATED",
      resourceId: savedDoctor._id,
    });

    expect(auditLog).not.toBeNull();
    expect(auditLog.actor.toString()).toBe(
      admin.user._id.toString()
    );
  });

  test("rejects doctor creation by a receptionist", async () => {
    const receptionist = await createTestUser({
      role: "receptionist",
    });

    const doctorUser = await createTestUser({ role: "doctor" });

    const response = await request(app)
      .post("/api/doctors")
      .set("Authorization", receptionist.authHeader)
      .send(createDoctorPayload(doctorUser.user._id));

    expect(response.status).toBe(403);
    expect(await Doctor.countDocuments()).toBe(0);
  });

  test("rejects linking a non-doctor user to a doctor profile", async () => {
    const receptionist = await createTestUser({
      role: "receptionist",
    });

    const response = await request(app)
      .post("/api/doctors")
      .set("Authorization", admin.authHeader)
      .send(createDoctorPayload(receptionist.user._id));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_DOCTOR_ROLE");
  });

  test("rejects invalid doctor payloads", async () => {
    const doctorUser = await createTestUser({ role: "doctor" });

    const response = await request(app)
      .post("/api/doctors")
      .set("Authorization", admin.authHeader)
      .send({
        user: doctorUser.user._id.toString(),
        specialization: "C",
        licenseNumber: "",
        consultationFee: -10,
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  test("rejects creating a second profile for the same doctor user", async () => {
    const doctorUser = await createTestUser({ role: "doctor" });
    const payload = createDoctorPayload(doctorUser.user._id);

    const firstResponse = await request(app)
      .post("/api/doctors")
      .set("Authorization", admin.authHeader)
      .send(payload);

    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app)
      .post("/api/doctors")
      .set("Authorization", admin.authHeader)
      .send({
        ...payload,
        licenseNumber: `${payload.licenseNumber}-SECOND`,
      });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.code).toBe("DOCTOR_PROFILE_EXISTS");
    expect(await Doctor.countDocuments()).toBe(1);
  });

  test("lists doctors with search and pagination", async () => {
    const first = await createTestDoctor(admin.user);
    const second = await createTestDoctor(admin.user);

    await Doctor.updateOne(
      { _id: first.doctor._id },
      {
        $set: {
          specialization: "Cardiology",
          licenseNumber: "CARD-TEST-001",
        },
      }
    );

    await Doctor.updateOne(
      { _id: second.doctor._id },
      {
        $set: {
          specialization: "Dermatology",
          licenseNumber: "DERM-TEST-001",
        },
      }
    );

    const response = await request(app)
      .get("/api/doctors?search=Cardiology&page=1&limit=1")
      .set("Authorization", admin.authHeader);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].specialization).toBe("Cardiology");
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(1);
    expect(response.body.pagination.total).toBe(1);
  });

  test("allows an authenticated doctor to read the doctors list but not create profiles", async () => {
    const { doctorUser } = await createTestDoctor(admin.user);

    const listResponse = await request(app)
      .get("/api/doctors")
      .set("Authorization", doctorUser.authHeader);

    expect(listResponse.status).toBe(200);

    const anotherDoctorUser = await createTestUser({ role: "doctor" });

    const createResponse = await request(app)
      .post("/api/doctors")
      .set("Authorization", doctorUser.authHeader)
      .send(createDoctorPayload(anotherDoctorUser.user._id));

    expect(createResponse.status).toBe(403);
  });

  test("updates a doctor profile and records the updater", async () => {
    const { doctor } = await createTestDoctor(admin.user);

    const response = await request(app)
      .patch(`/api/doctors/${doctor._id}`)
      .set("Authorization", admin.authHeader)
      .send({
        specialization: "Neurology",
        consultationFee: 420,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.specialization).toBe("Neurology");
    expect(response.body.data.consultationFee).toBe(420);

    const updated = await Doctor.findById(doctor._id);

    expect(updated.updatedBy.toString()).toBe(
      admin.user._id.toString()
    );
  });

  test("deactivates a doctor instead of deleting the record", async () => {
    const { doctor } = await createTestDoctor(admin.user);

    const response = await request(app)
      .delete(`/api/doctors/${doctor._id}`)
      .set("Authorization", admin.authHeader);

    expect(response.status).toBe(200);

    const savedDoctor = await Doctor.findById(doctor._id);

    expect(savedDoctor).not.toBeNull();
    expect(savedDoctor.isActive).toBe(false);
    expect(savedDoctor.updatedBy.toString()).toBe(
      admin.user._id.toString()
    );

    const listResponse = await request(app)
      .get("/api/doctors")
      .set("Authorization", admin.authHeader);

    expect(listResponse.body.data).toHaveLength(0);
  });

  test("returns 404 for a doctor ID that does not exist", async () => {
    const response = await request(app)
      .get("/api/doctors/507f1f77bcf86cd799439011")
      .set("Authorization", admin.authHeader);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("DOCTOR_NOT_FOUND");
  });

  test("rejects requests without authentication", async () => {
    const response = await request(app).get("/api/doctors");

    expect(response.status).toBe(401);
  });
});
