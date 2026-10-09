const jwt = require("jsonwebtoken");
const User = require("../modules/User/user.model");

const socketAuth = async (socket, next) => {
  try {
    const cookies = socket.handshake.headers.cookie || "";

    const accessToken = cookies
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("accessToken="))
      ?.split("=")[1];

    if (!accessToken) {
      const error = new Error("Authentication required");
      error.code = "UNAUTHORIZED";
      return next(error);
    }

    let decoded;

    try {
      decoded = jwt.verify(
        accessToken,
        process.env.JWT_ACCESS_SECRET
      );
    } catch (error) {
      const socketError = new Error(
        error.name === "TokenExpiredError"
          ? "Access token expired"
          : "Invalid access token"
      );

      socketError.code =
        error.name === "TokenExpiredError"
          ? "TOKEN_EXPIRED"
          : "INVALID_TOKEN";

      return next(socketError);
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      const error = new Error("User not found");
      error.code = "UNAUTHORIZED";
      return next(error);
    }

    if (!user.isActive) {
      const error = new Error("Account is inactive");
      error.code = "ACCOUNT_INACTIVE";
      return next(error);
    }

    if (user.passwordChangedAt && decoded.iat) {
      const changedTimestamp = Math.floor(
        user.passwordChangedAt.getTime() / 1000
      );

      if (decoded.iat < changedTimestamp) {
        const error = new Error(
          "User recently changed password. Please log in again"
        );

        error.code = "TOKEN_EXPIRED";
        return next(error);
      }
    }

    socket.user = user;

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = socketAuth;