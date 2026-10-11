// middlewares/requestId.js
const crypto = require("crypto");

const requestId = (req, res, next) => {
  const incomingId = req.headers["x-request-id"];
  const id = incomingId && typeof incomingId === "string" && incomingId.trim()
    ? incomingId.trim()
    : crypto.randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
};

module.exports = requestId;
