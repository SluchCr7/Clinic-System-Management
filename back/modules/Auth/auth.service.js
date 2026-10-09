const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../User/user.model");
const { AppError } = require("../../middlewares/errorHandler");
const { generateRefreshToken, generateAccessToken } = require("../../middlewares/generateToken");
const auditLogService = require("../AuditLog/auditLog.service");

const login = async (email, password, requestInfo = {}) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new AppError(
      "Invalid email or password",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  if (!user.isActive) {
    throw new AppError(
      "This account is inactive",
      403,
      "ACCOUNT_INACTIVE"
    );
  }

  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    await auditLogService.logActivity({
      actor: user,
      action: "LOGIN_FAILED",
      resource: "User",
      resourceId: user._id,
      details: { email: user.email, reason: "INVALID_PASSWORD" },
      ipAddress: requestInfo.ipAddress || null,
      userAgent: requestInfo.userAgent || null,
    });

    throw new AppError(
      "Invalid email or password",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.lastLogin = new Date();
  await user.save();

  await auditLogService.logActivity({
    actor: user,
    action: "LOGIN_SUCCESS",
    resource: "User",
    resourceId: user._id,
    details: { email: user.email, role: user.role },
    ipAddress: requestInfo.ipAddress || null,
    userAgent: requestInfo.userAgent || null,
  });

  return {
    user,
    accessToken,
    refreshToken,
  };
};

const getMe = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(
      "User not found",
      404,
      "USER_NOT_FOUND"
    );
  }

  return user;
};

const refreshAccessToken = async (refreshToken, requestInfo = {}) => {
  if (!refreshToken) {
    throw new AppError(
      "Refresh token is required",
      401,
      "REFRESH_TOKEN_REQUIRED"
    );
  }

  let decoded;

  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new AppError(
        "Refresh token expired",
        401,
        "REFRESH_TOKEN_EXPIRED"
      );
    }

    throw new AppError(
      "Invalid refresh token",
      401,
      "INVALID_REFRESH_TOKEN"
    );
  }

  const user = await User.findById(decoded.id);

  if (!user) {
    throw new AppError(
      "User not found",
      401,
      "UNAUTHORIZED"
    );
  }

  if (!user.isActive) {
    throw new AppError(
      "Account is inactive",
      403,
      "ACCOUNT_INACTIVE"
    );
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

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  await auditLogService.logActivity({
    actor: user,
    action: "TOKEN_REFRESHED",
    resource: "User",
    resourceId: user._id,
    details: { email: user.email },
    ipAddress: requestInfo.ipAddress || null,
    userAgent: requestInfo.userAgent || null,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const changePassword = async (
  userId,
  currentPassword,
  newPassword,
  currentUser = null
) => {
  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw new AppError(
      "User not found",
      404,
      "USER_NOT_FOUND"
    );
  }

  const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);

  if (!isPasswordCorrect) {
    throw new AppError(
      "Current password is incorrect",
      401,
      "INVALID_CURRENT_PASSWORD"
    );
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);

  if (isSamePassword) {
    throw new AppError(
      "New password must be different from current password",
      400,
      "SAME_PASSWORD"
    );
  }

  user.password = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();

  await user.save();

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "PASSWORD_CHANGED",
      resource: "User",
      resourceId: user._id,
      details: {
        user: user._id,
        passwordChangedAt: user.passwordChangedAt,
      },
    });
  }

  return user;
};

module.exports = {
  login,
  getMe,
  refreshAccessToken,
  changePassword,
};