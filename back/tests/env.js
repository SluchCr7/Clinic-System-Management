process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET =
  "clinic-test-access-secret-with-at-least-32-characters";
process.env.JWT_REFRESH_SECRET =
  "clinic-test-refresh-secret-with-at-least-32-characters";
process.env.JWT_ACCESS_EXPIRE = "15m";
process.env.JWT_REFRESH_EXPIRE = "7d";
