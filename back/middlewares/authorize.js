const {AppError} = require("./errorHandler");

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          "You are not authorized to perform this action",
          403,
          "FORBIDDEN"
        )
      );
    }

    next();
  };
};

module.exports = authorize;