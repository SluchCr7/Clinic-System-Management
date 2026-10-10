const request = require("supertest");
const app = require("../index");
const User = require("../modules/User/user.model");
const { createTestUser } = require("./testHelper");

describe("Authentication and user provisioning API", () => {
  let administrator;

  beforeEach(async () => {
    administrator = await createTestUser({ role: "admin" });
  });

  describe("POST /api/users (administrator account provisioning)", () => {
    test("creates a user account that can subsequently log in", async () => {
      const newAccount = {
        firstName: "Robin",
        lastName: "Receptionist",
        email: "robin.receptionist@example.com",
        password: "AnotherStrongPassword123!",
        phone: "555-0199",
        role: "receptionist",
      };

      const createResponse = await request(app)
        .post("/api/users")
        .set("Authorization", administrator.authHeader)
        .send(newAccount);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.email).toBe(newAccount.email);
      expect(createResponse.body.data.password).toBeUndefined();

      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: newAccount.email,
          password: newAccount.password,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.user.email).toBe(newAccount.email);
      expect(loginResponse.headers["set-cookie"]).toEqual(
        expect.arrayContaining([
          expect.stringContaining("accessToken="),
          expect.stringContaining("refreshToken="),
        ])
      );
    });

    test("rejects provisioning without an administrator token", async () => {
      const response = await request(app)
        .post("/api/users")
        .send({
          firstName: "Robin",
          lastName: "Receptionist",
          email: "robin.receptionist@example.com",
          password: "AnotherStrongPassword123!",
          phone: "555-0199",
          role: "receptionist",
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    test("authenticates a user and sets HTTP-only access and refresh cookies", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: administrator.user.email,
          password: administrator.plainPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(administrator.user.email);
      expect(response.headers["set-cookie"]).toEqual(
        expect.arrayContaining([
          expect.stringContaining("accessToken="),
          expect.stringContaining("refreshToken="),
        ])
      );
      expect(response.headers["set-cookie"].every((cookie) =>
        cookie.includes("HttpOnly")
      )).toBe(true);
    });

    test("rejects invalid credentials", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: administrator.user.email,
          password: "incorrect-password",
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_CREDENTIALS");
    });

    test("rejects malformed or missing login fields", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "not-an-email" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    test("rejects login for an inactive user", async () => {
      const inactiveUser = await createTestUser({
        role: "doctor",
        isActive: false,
      });

      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: inactiveUser.user.email,
          password: inactiveUser.plainPassword,
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe("ACCOUNT_INACTIVE");
    });
  });

  describe("GET /api/auth/me (authentication middleware)", () => {
    test("returns the current user for a valid Bearer access token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", administrator.authHeader);

      expect(response.status).toBe(200);
      expect(response.body.data.user._id).toBe(
        administrator.user._id.toString()
      );
      expect(response.body.data.user.password).toBeUndefined();
    });

    test("rejects missing and invalid Bearer tokens", async () => {
      const missingToken = await request(app).get("/api/auth/me");
      const invalidToken = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(missingToken.status).toBe(401);
      expect(invalidToken.status).toBe(401);
    });
  });

  test("refreshes tokens and invalidates access tokens after password changes", async () => {
    const refreshResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refreshToken=${administrator.refreshToken}`);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("accessToken="),
        expect.stringContaining("refreshToken="),
      ])
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));
    const passwordResponse = await request(app)
      .patch("/api/auth/change-password")
      .set("Authorization", administrator.authHeader)
      .send({
        currentPassword: administrator.plainPassword,
        newPassword: "UpdatedStrongPassword456!",
        confirmPassword: "UpdatedStrongPassword456!",
      });

    expect(passwordResponse.status).toBe(200);

    const expiredAccessResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", administrator.authHeader);
    const updatedUser = await User.findById(administrator.user._id).select(
      "+password"
    );

    expect(expiredAccessResponse.status).toBe(401);
    expect(expiredAccessResponse.body.code).toBe("TOKEN_EXPIRED");
    expect(
      await require("bcrypt").compare(
        "UpdatedStrongPassword456!",
        updatedUser.password
      )
    ).toBe(true);
  });
});
