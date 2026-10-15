const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");

describe("Health Check", () => {
  it("should return API health status", async () => {
    const response = await request(app)
      .get("/health");

    expect(response.statusCode).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.status).toBe("ok");
  });

  it("reports the API as unavailable when MongoDB is disconnected", async () => {
    const originalReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 0;

    try {
      const response = await request(app).get("/health");

      expect(response.statusCode).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.status).toBe("unavailable");
      expect(response.body.database).toBe("disconnected");
    } finally {
      mongoose.connection.readyState = originalReadyState;
    }
  });
});