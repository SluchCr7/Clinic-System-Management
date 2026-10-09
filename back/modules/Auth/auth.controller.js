const asyncHandler = require("express-async-handler");

const authService = require("./auth.service");

// Login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { user, accessToken, refreshToken } =
    await authService.login(email, password, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

  // Access Token
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production"
      ? "none"
      : "lax",
    maxAge: 15 * 60 * 1000,
  });

  // Refresh Token
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production"
      ? "none"
      : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    },
  });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user._id);

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
});

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite:
    process.env.NODE_ENV === "production" ? "none" : "lax",
};

const logout = asyncHandler(async (req, res) => {
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  const tokens = await authService.refreshAccessToken(refreshToken, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.cookie("accessToken", tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production"
        ? "none"
        : "lax",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production"
        ? "none"
        : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: "Access token refreshed successfully",
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  await authService.changePassword(
    req.user._id,
    currentPassword,
    newPassword,
    req.user
  );

  res.status(200).json({
    success: true,
    message: "Password Updated Successfully",
  });
});

module.exports = {
    login,
    getMe,
    logout,
    refreshAccessToken,
    changePassword
};