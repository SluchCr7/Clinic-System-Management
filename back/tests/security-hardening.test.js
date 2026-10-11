const request = require("supertest");
const app = require("../index");
const User = require("../modules/User/user.model");
const { createTestUser } = require("./testHelper");

describe("Security Hardening & Token Lifecycle API", () => {
  let adminUser;
  let regularUser;

  beforeEach(async () => {
    adminUser = await createTestUser({ role: "admin" });
    regularUser = await createTestUser({ role: "doctor" });
  });

  describe("Request Traceability & Headers", () => {
    test("attaches an X-Request-Id header to responses", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.headers["x-request-id"]).toBeDefined();
      expect(response.headers["x-request-id"].length).toBeGreaterThan(10);
    });

    test("preserves client-provided X-Request-Id header", async () => {
      const customId = "trace-req-client-12345";
      const response = await request(app)
        .get("/health")
        .set("X-Request-Id", customId);

      expect(response.status).toBe(200);
      expect(response.headers["x-request-id"]).toBe(customId);
    });
  });

  describe("JSON Body Parsing & Malformed Payloads", () => {
    test("returns 400 INVALID_JSON on malformed JSON payload", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send("{ broken json body: ");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("INVALID_JSON");
      expect(response.body.message).toContain("Malformed JSON");
    });
  });

  describe("NoSQL Injection Sanitization", () => {
    test("neutralizes $ operators in request body", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: { $gt: "" },
          password: adminUser.plainPassword,
        });

      // Sanitizer neutralizes { $gt: "" } into empty object, failing validation cleanly
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    test("neutralizes operator query parameters in GET requests", async () => {
      const response = await request(app)
        .get("/api/users?role[$gt]=")
        .set("Authorization", adminUser.authHeader);

      // Operator in query is stripped by sanitizer and fails Joi validation safely without crashing Express 5
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Token Type Enforcement", () => {
    test("rejects a refresh token when sent to a protected endpoint expecting access token", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${adminUser.refreshToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_TOKEN");
      expect(response.body.message).toContain("access token");
    });

    test("rejects an access token sent to the refresh endpoint", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", `refreshToken=${adminUser.accessToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_REFRESH_TOKEN");
    });
  });

  describe("Refresh Token Rotation & Replay Attack Detection", () => {
    test("detects refresh token replay and invalidates user sessions", async () => {
      // 1. Log in to establish an active session with tracked tokenId
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: adminUser.user.email,
          password: adminUser.plainPassword,
        });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];
      const refreshCookie = cookies
        .find((c) => c.startsWith("refreshToken="))
        .split(";")[0];
      expect(refreshCookie).toBeDefined();

      // 2. Perform legitimate refresh (rotates the token)
      const refresh1 = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie);

      expect(refresh1.status).toBe(200);
      const newCookies = refresh1.headers["set-cookie"];
      const newRefreshCookie = newCookies
        .find((c) => c.startsWith("refreshToken="))
        .split(";")[0];

      // 3. Replay attack: Attacker tries to use the old (already-rotated) refresh token again
      const replayRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie);

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.code).toBe("INVALID_REFRESH_TOKEN");
      expect(replayRes.body.message).toContain("Suspicious token reuse");

      // 4. Verify that even the legitimate new rotated token is now invalidated due to lockout
      const refreshAfterLockout = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", newRefreshCookie);

      expect(refreshAfterLockout.status).toBe(401);
    });

    test("server-side logout revokes the refresh token", async () => {
      // 1. Log in
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: regularUser.user.email,
          password: regularUser.plainPassword,
        });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];
      const refreshCookie = cookies
        .find((c) => c.startsWith("refreshToken="))
        .split(";")[0];

      // 2. Logout with the cookie
      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", refreshCookie);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // 3. Attempting to refresh with the logged out token fails
      const refreshAttempt = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie);

      expect(refreshAttempt.status).toBe(401);
    });

    test("deactivated user account cannot refresh access token", async () => {
      // 1. Log in
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: regularUser.user.email,
          password: regularUser.plainPassword,
        });

      const refreshCookie = loginRes.headers["set-cookie"]
        .find((c) => c.startsWith("refreshToken="))
        .split(";")[0];

      // 2. Administrator deactivates the user
      const deactRes = await request(app)
        .delete(`/api/users/${regularUser.user._id}`)
        .set("Authorization", adminUser.authHeader);

      expect(deactRes.status).toBe(200);

      // 3. User attempts to refresh token -> rejected
      const refreshAttempt = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie);

      expect(refreshAttempt.status).toBe(403);
      expect(refreshAttempt.body.code).toBe("ACCOUNT_INACTIVE");
    });
  });
});
