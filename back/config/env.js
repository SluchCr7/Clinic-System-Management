const validateEnv = () => {
  const required = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
  if (process.env.NODE_ENV !== "test") {
    required.push("MONGO_URI");
  }

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Fatal configuration error: Missing required environment variable(s): ${missing.join(
        ", "
      )}`
    );
  }
};

module.exports = { validateEnv };
