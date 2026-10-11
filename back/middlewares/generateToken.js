const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      type: "access",
      tokenVersion: user.tokenVersion || 0,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRE || "15m",
      algorithm: "HS256",
    }
  );
};

const generateRefreshToken = (user, tokenId = null) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      type: "refresh",
      tokenId: tokenId || crypto.randomUUID(),
      tokenVersion: user.tokenVersion || 0,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || "7d",
      algorithm: "HS256",
    }
  );
};

module.exports = { generateAccessToken, generateRefreshToken };