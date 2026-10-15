const request = require("supertest");
const jwt = require("jsonwebtoken");
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
      expect(missingToken.body.code).toBe("UNAUTHORIZED");
      expect(invalidToken.status).toBe(401);
    });

    test("refreshes an expired access-cookie session and retries the request", async () => {
      const expiredAccessResponse = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `refreshToken=${administrator.refreshToken}`);

      expect(expiredAccessResponse.status).toBe(401);
      expect(expiredAccessResponse.body.code).toBe("TOKEN_EXPIRED");

      const refreshResponse = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${administrator.refreshToken}`);

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.headers["set-cookie"]).toEqual(
        expect.arrayContaining([
          expect.stringContaining("accessToken="),
          expect.stringContaining("refreshToken="),
        ])
      );
      expect(
        refreshResponse.headers["set-cookie"].every((cookie) =>
          cookie.includes("HttpOnly")
        )
      ).toBe(true);

      const replacementCookies = refreshResponse.headers["set-cookie"].map(
        (cookie) => cookie.split(";")[0]
      );
      const retriedResponse = await request(app)
        .get("/api/auth/me")
        .set("Cookie", replacementCookies.join("; "));

      expect(retriedResponse.status).toBe(200);
      expect(retriedResponse.body.data.user._id).toBe(
        administrator.user._id.toString()
      );
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

  test("rejects a signed refresh token that is not an active session", async () => {
    await User.updateOne(
      { _id: administrator.user._id },
      { $set: { activeRefreshTokens: [] } }
    );
    const currentUser = await User.findById(administrator.user._id);
    const untrackedRefreshToken = jwt.sign(
      {
        id: currentUser._id,
        type: "refresh",
        tokenId: "not-an-active-session",
        tokenVersion: currentUser.tokenVersion,
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d", algorithm: "HS256" }
    );

    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refreshToken=${untrackedRefreshToken}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("REFRESH_TOKEN_EXPIRED");
    const updatedUser = await User.findById(administrator.user._id);
    expect(updatedUser.tokenVersion).toBe(currentUser.tokenVersion);
    expect(updatedUser.activeRefreshTokens).toHaveLength(0);
  });

  test("does not revoke sessions when an old signed refresh token is presented to logout", async () => {
    const currentUser = await User.findById(administrator.user._id);
    const oldRefreshToken = jwt.sign(
      {
        id: currentUser._id,
        type: "refresh",
        tokenId: "revoked-session",
        tokenVersion: currentUser.tokenVersion,
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d", algorithm: "HS256" }
    );

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `refreshToken=${oldRefreshToken}`);

    const updatedUser = await User.findById(administrator.user._id);
    expect(response.status).toBe(200);
    expect(updatedUser.tokenVersion).toBe(currentUser.tokenVersion);
    expect(updatedUser.activeRefreshTokens).toEqual(
      currentUser.activeRefreshTokens
    );
  });

  describe("POST /api/auth/logout", () => {
    const loginAndGetRefreshCookie = async () => {
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: administrator.user.email,
          password: administrator.plainPassword,
        });
      const refreshCookie = loginResponse.headers["set-cookie"].find((cookie) =>
        cookie.startsWith("refreshToken=")
      );

      return refreshCookie.split(";")[0];
    };

    test("does not revoke sessions for a forged refresh token", async () => {
      await loginAndGetRefreshCookie();
      const beforeLogout = await User.findById(administrator.user._id);
      const forgedToken = require("jsonwebtoken").sign(
        {
          id: administrator.user._id.toString(),
          type: "refresh",
          tokenId: "forged-token",
        },
        "not-the-refresh-secret"
      );

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", `refreshToken=${forgedToken}`);

      const afterLogout = await User.findById(administrator.user._id);
      expect(response.status).toBe(200);
      expect(afterLogout.tokenVersion).toBe(beforeLogout.tokenVersion);
      expect(afterLogout.activeRefreshTokens).toEqual(
        beforeLogout.activeRefreshTokens
      );
    });

    test("revokes sessions for a valid refresh token", async () => {
      const refreshCookie = await loginAndGetRefreshCookie();
      const beforeLogout = await User.findById(administrator.user._id);

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", refreshCookie);

      const loggedOutUser = await User.findById(administrator.user._id);
      expect(response.status).toBe(200);
      expect(loggedOutUser.tokenVersion).toBe(
        beforeLogout.tokenVersion + 1
      );
      expect(loggedOutUser.activeRefreshTokens).toHaveLength(0);
    });

    test("does not expose logout as a state-changing GET route", async () => {
      const response = await request(app).get("/api/auth/logout");

      expect(response.status).toBe(404);
    });
  });
});
