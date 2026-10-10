const request = require("supertest");
const app = require("../index");
const Patient = require("../modules/Patient/patient.model");
const AuditLog = require("../modules/AuditLog/auditLog.model");
const { createTestUser } = require("./testHelper");

describe("Patients API", () => {
  let admin;
  let receptionist;
  let doctor;

  beforeAll(async () => {
    await Patient.init();
  });

  beforeEach(async () => {
    admin = await createTestUser({ role: "admin" });
    receptionist = await createTestUser({ role: "receptionist" });
    doctor = await createTestUser({ role: "doctor" });
  });

  const newPatient = (overrides = {}) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      firstName: "Jordan",
      lastName: "Patient",
      dateOfBirth: "1985-07-13",
      gender: "male",
      phone: `555-${suffix}`,
      email: `jordan.${suffix}@example.com`,
      bloodType: "O+",
      allergies: ["Penicillin"],
      chronicDiseases: ["Asthma"],
      ...overrides,
    };
  };

  test("creates a patient profile and records an audit log", async () => {
    const payload = newPatient();
    const response = await request(app)
      .post("/api/patients")
      .set("Authorization", receptionist.authHeader)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.firstName).toBe(payload.firstName);
    expect(response.body.data.createdBy).toBe(receptionist.user._id.toString());

    const [savedPatient, auditLog] = await Promise.all([
      Patient.findById(response.body.data._id),
      AuditLog.findOne({
        action: "PATIENT_CREATED",
        resourceId: response.body.data._id,
      }),
    ]);

    expect(savedPatient).not.toBeNull();
    expect(savedPatient.phone).toBe(payload.phone);
    expect(auditLog).not.toBeNull();
    expect(auditLog.actor.toString()).toBe(receptionist.user._id.toString());
  });

  test("retrieves a patient profile", async () => {
    const patient = await Patient.create({
      ...newPatient(),
      createdBy: receptionist.user._id,
    });

    const response = await request(app)
      .get(`/api/patients/${patient._id}`)
      .set("Authorization", receptionist.authHeader);

    expect(response.status).toBe(200);
    expect(response.body.data._id).toBe(patient._id.toString());
    expect(response.body.data.email).toBe(patient.email);
    expect(response.body.data.allergies).toContain("Penicillin");
  });

  test.each([
    ["phone", "555-duplicate"],
    ["email", "duplicate@example.com"],
  ])("rejects a duplicate patient %s", async (field, value) => {
    await Patient.create({
      ...newPatient({ [field]: value }),
      createdBy: receptionist.user._id,
    });

    const response = await request(app)
      .post("/api/patients")
      .set("Authorization", admin.authHeader)
      .send(newPatient({ [field]: value }));

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("DUPLICATE_FIELD");
    expect(await Patient.countDocuments()).toBe(1);
  });

  test("updates patient medical records and records the updater", async () => {
    const patient = await Patient.create({
      ...newPatient(),
      createdBy: receptionist.user._id,
    });

    const response = await request(app)
      .patch(`/api/patients/${patient._id}`)
      .set("Authorization", receptionist.authHeader)
      .send({
        bloodType: "A+",
        allergies: ["Penicillin", "Latex"],
        chronicDiseases: ["Asthma", "Diabetes"],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.bloodType).toBe("A+");
    expect(response.body.data.allergies).toEqual(["Penicillin", "Latex"]);
    expect(response.body.data.chronicDiseases).toContain("Diabetes");

    const [savedPatient, auditLog] = await Promise.all([
      Patient.findById(patient._id),
      AuditLog.findOne({
        action: "PATIENT_UPDATED",
        resourceId: patient._id,
      }),
    ]);

    expect(savedPatient.updatedBy.toString()).toBe(
      receptionist.user._id.toString()
    );
    expect(auditLog).not.toBeNull();
  });

  test("lists patients by search term with pagination metadata", async () => {
    await Patient.create([
      {
        ...newPatient({
          firstName: "Searchable",
          phone: "555-search-1",
          email: "searchable.one@example.com",
        }),
        createdBy: receptionist.user._id,
      },
      {
        ...newPatient({
          firstName: "Searchable",
          phone: "555-search-2",
          email: "searchable.two@example.com",
        }),
        createdBy: receptionist.user._id,
      },
      {
        ...newPatient({
          firstName: "Different",
          phone: "555-search-3",
          email: "different@example.com",
        }),
        createdBy: receptionist.user._id,
      },
    ]);

    const response = await request(app)
      .get("/api/patients?search=Searchable&page=1&limit=1")
      .set("Authorization", admin.authHeader);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].firstName).toBe("Searchable");
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 1,
      total: 2,
    });
  });

  test("rejects invalid patient data and doctor attempts to create patients", async () => {
    const invalid = await request(app)
      .post("/api/patients")
      .set("Authorization", receptionist.authHeader)
      .send(newPatient({ dateOfBirth: "2099-01-01", gender: "unknown" }));

    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("VALIDATION_ERROR");

    const forbidden = await request(app)
      .post("/api/patients")
      .set("Authorization", doctor.authHeader)
      .send(newPatient());

    expect(forbidden.status).toBe(403);
  });

  test("requires authentication and returns not found for an unknown patient", async () => {
    await request(app).get("/api/patients").expect(401);

    const response = await request(app)
      .get("/api/patients/507f1f77bcf86cd799439011")
      .set("Authorization", admin.authHeader);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("PATIENT_NOT_FOUND");
  });
});
