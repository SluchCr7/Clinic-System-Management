const request = require("supertest");
const app = require("../index");

describe("Health Check", () => {
  it("should return API health status", async () => {
    const response = await request(app)
      .get("/health");

    expect(response.statusCode).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.status).toBe("ok");
  });
});