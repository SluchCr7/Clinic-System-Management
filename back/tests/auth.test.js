const request = require("supertest");
const app = require("../index");
const User = require("../modules/User/user.model");
const { createTestUser } = require("./testHelper");

describe("Authentication API", () => {
  let testUser;

  beforeEach(async () => {
    testUser = await createTestUser({
      role: "admin",
      password: "StrongPassword123!",
    });
  });

  afterEach(async () => {
    await User.deleteMany({ email: /@clinic\.com$/ });
  });

  it("should login successfully with valid credentials and return tokens", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.user.email,
        password: "StrongPassword123!",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testUser.user.email);
    expect(res.body.data.accessToken).toBeDefined();

    // Check Set-Cookie headers
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.includes("accessToken="))).toBe(true);
    expect(cookies.some((c) => c.includes("refreshToken="))).toBe(true);
  });

  it("should reject login with invalid password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.user.email,
        password: "WrongPassword!",
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("should reject login for inactive users", async () => {
    const inactiveUser = await createTestUser({
      role: "doctor",
      password: "Password123!",
      isActive: false,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: inactiveUser.user.email,
        password: "Password123!",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("ACCOUNT_INACTIVE");
  });

  it("should return current user profile via GET /api/auth/me", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", testUser.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user._id).toBe(testUser.user._id.toString());
    expect(res.body.data.user.password).toBeUndefined();
  });

  it("should rotate refresh token and issue new access token on POST /api/auth/refresh", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`refreshToken=${testUser.refreshToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();

    const cookies = res.headers["set-cookie"];
    expect(cookies.some((c) => c.includes("refreshToken="))).toBe(true);
  });

  it("should change password and invalidate prior tokens", async () => {
    const res = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", testUser.authHeader)
      .send({
        currentPassword: "StrongPassword123!",
        newPassword: "NewStrongPassword456!",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Old token should now be rejected because passwordChangedAt was updated
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", testUser.authHeader);

    expect(meRes.status).toBe(401);
    expect(meRes.body.code).toBe("TOKEN_EXPIRED");
  });

  it("should logout cleanly and clear auth cookies", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", testUser.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cookies = res.headers["set-cookie"];
    expect(cookies.some((c) => c.includes("accessToken=;"))).toBe(true);
    expect(cookies.some((c) => c.includes("refreshToken=;"))).toBe(true);
  });
});
