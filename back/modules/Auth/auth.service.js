const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../User/user.model");
const { AppError } = require("../../middlewares/errorHandler");
const {
  generateRefreshToken,
  generateAccessToken,
} = require("../../middlewares/generateToken");
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

  if (user.activeRefreshTokens.length > 0) {
    user.tokenVersion = (user.tokenVersion || 0) + 1;
  }

  const tokenId = crypto.randomUUID();
  user.activeRefreshTokens = [{ tokenId, createdAt: new Date() }];
  user.lastLogin = new Date();
  await user.save();

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, tokenId);

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

  if (decoded.type && decoded.type !== "refresh") {
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

  if (
    decoded.tokenVersion !== undefined &&
    user.tokenVersion !== undefined &&
    decoded.tokenVersion < user.tokenVersion
  ) {
    throw new AppError(
      "Refresh token has been revoked",
      401,
      "REFRESH_TOKEN_EXPIRED"
    );
  }

  if (!decoded.tokenId) {
    throw new AppError(
      "Invalid refresh token",
      401,
      "INVALID_REFRESH_TOKEN"
    );
  }

  const activeRefreshTokens = Array.isArray(user.activeRefreshTokens)
    ? user.activeRefreshTokens
    : [];
  const tokenIndex = activeRefreshTokens.findIndex(
    (token) => token.tokenId === decoded.tokenId
  );

  if (tokenIndex === -1) {
    if (activeRefreshTokens.length > 0) {
      // Replay detected! An old/already used refresh token was presented.
      user.activeRefreshTokens = [];
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      await auditLogService.logActivity({
        actor: user,
        action: "REFRESH_TOKEN_REPLAY_DETECTED",
        resource: "User",
        resourceId: user._id,
        details: { email: user.email, tokenId: decoded.tokenId },
        ipAddress: requestInfo.ipAddress || null,
        userAgent: requestInfo.userAgent || null,
      });

      throw new AppError(
        "Suspicious token reuse detected. All sessions have been terminated",
        401,
        "INVALID_REFRESH_TOKEN"
      );
    }

    throw new AppError(
      "Refresh token has been revoked",
      401,
      "REFRESH_TOKEN_EXPIRED"
    );
  }

  // Remove the consumed token
  user.activeRefreshTokens.splice(tokenIndex, 1);

  // Issue new rotated token
  const newTokenId = crypto.randomUUID();
  if (!Array.isArray(user.activeRefreshTokens)) {
    user.activeRefreshTokens = [];
  }
  user.activeRefreshTokens.push({
    tokenId: newTokenId,
    createdAt: new Date(),
  });

  // Limit stored active sessions to at most 10
  if (user.activeRefreshTokens.length > 10) {
    user.activeRefreshTokens = user.activeRefreshTokens.slice(-10);
  }

  await user.save();

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user, newTokenId);

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

const logout = async (refreshToken, currentUser = null, requestInfo = {}) => {
  let user = currentUser;

  if (refreshToken) {
    let decoded;

    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, {
        algorithms: ["HS256"],
        ignoreExpiration: true,
      });
    } catch (error) {
      if (!(error instanceof jwt.JsonWebTokenError)) {
        throw error;
      }
    }

    if (
      decoded?.type === "refresh" &&
      decoded.id &&
      decoded.tokenId &&
      decoded.tokenVersion !== undefined
    ) {
      const foundUser = await User.findOneAndUpdate(
        {
          _id: decoded.id,
          tokenVersion: decoded.tokenVersion,
          "activeRefreshTokens.tokenId": decoded.tokenId,
        },
        {
          $inc: { tokenVersion: 1 },
          $set: { activeRefreshTokens: [] },
        },
        { returnDocument: "after" }
      );

      if (foundUser) {
        user = foundUser;
      }
    }
  } else if (user) {
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.activeRefreshTokens = [];
    await user.save();
  }

  if (user?._id) {
    await auditLogService.logActivity({
      actor: user,
      action: "LOGOUT_SUCCESS",
      resource: "User",
      resourceId: user._id,
      details: { email: user.email },
      ipAddress: requestInfo.ipAddress || null,
      userAgent: requestInfo.userAgent || null,
    });
  }
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
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.activeRefreshTokens = [];

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
  logout,
  changePassword,
};