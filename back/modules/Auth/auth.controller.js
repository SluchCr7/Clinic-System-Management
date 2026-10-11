const asyncHandler = require("express-async-handler");
const authService = require("./auth.service");

const getCookieOptions = (maxAge = null) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  ...(maxAge ? { maxAge } : {}),
});

// Login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { user, accessToken, refreshToken } =
    await authService.login(email, password, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

  // Access Token Cookie
  res.cookie("accessToken", accessToken, getCookieOptions(15 * 60 * 1000));

  // Refresh Token Cookie
  res.cookie(
    "refreshToken",
    refreshToken,
    getCookieOptions(7 * 24 * 60 * 60 * 1000)
  );

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

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  await authService.logout(refreshToken, req.user || null, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  const clearOptions = getCookieOptions();
  res.clearCookie("accessToken", clearOptions);
  res.clearCookie("refreshToken", clearOptions);

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

  res.cookie("accessToken", tokens.accessToken, getCookieOptions(15 * 60 * 1000));
  res.cookie(
    "refreshToken",
    tokens.refreshToken,
    getCookieOptions(7 * 24 * 60 * 60 * 1000)
  );

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

  // Clear existing cookies so user is prompted to re-authenticate with new credentials
  const clearOptions = getCookieOptions();
  res.clearCookie("accessToken", clearOptions);
  res.clearCookie("refreshToken", clearOptions);

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
  changePassword,
};