const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

const User = require("../modules/User/user.model");
const { AppError } = require("./errorHandler");

const protect = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.accessToken;

  if (
    !token &&
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new AppError("Access token expired", 401, "TOKEN_EXPIRED");
    }

    throw new AppError("Invalid access token", 401, "INVALID_TOKEN");
  }

  if (decoded.type && decoded.type !== "access") {
    throw new AppError("Invalid access token", 401, "INVALID_TOKEN");
  }

  const user = await User.findById(decoded.id);

  if (!user) {
    throw new AppError("User not found", 401, "UNAUTHORIZED");
  }

  if (!user.isActive) {
    throw new AppError("Account is inactive", 403, "ACCOUNT_INACTIVE");
  }

  if (user.passwordChangedAt && decoded.iat) {
    const changedTimestamp = parseInt(
      user.passwordChangedAt.getTime() / 1000,
      10
    );

    if (decoded.iat < changedTimestamp) {
      throw new AppError(
        "User recently changed password. Please log in again",
        401,
        "TOKEN_EXPIRED"
      );
    }
  }

  if (
    decoded.tokenVersion !== undefined &&
    user.tokenVersion !== undefined &&
    decoded.tokenVersion < user.tokenVersion
  ) {
    throw new AppError(
      "Session has expired or was revoked. Please log in again",
      401,
      "TOKEN_EXPIRED"
    );
  }

  req.user = user;

  next();
});

module.exports = protect;