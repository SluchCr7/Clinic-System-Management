const { AppError } = require("./errorHandler");
const { hasPermission } = require("../config/permissions");

/**
 * Role-based authorization middleware
 * Usage: authorize("admin", "doctor")
 */
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

/**
 * Permission-based authorization middleware
 * Usage: authorizePermission("patients:create")
 */
const authorizePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError(
          "Authentication required",
          401,
          "UNAUTHORIZED"
        )
      );
    }

    const isAllowed = requiredPermissions.some((perm) =>
      hasPermission(req.user.role, perm)
    );

    if (!isAllowed) {
      return next(
        new AppError(
          "You do not have permission to perform this action",
          403,
          "FORBIDDEN"
        )
      );
    }

    next();
  };
};

module.exports = authorize;
module.exports.authorize = authorize;
module.exports.authorizePermission = authorizePermission;
