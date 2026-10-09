// src/middlewares/errorHandler.js

class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_SERVER_ERROR") {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}


const errorHandler = (err, req, res, next) => {
  let error = err;

  // Mongoose: Invalid ObjectId
  if (err.name === "CastError") {
    error = new AppError(
      `Invalid ${err.path}: ${err.value}`,
      400,
      "INVALID_ID"
    );
  }

  // Mongoose: Duplicate field
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "Field";

    error = new AppError(
      `${field} already exists`,
      409,
      "DUPLICATE_FIELD"
    );
  }

  // Mongoose: Validation Error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((errItem) => ({
      field: errItem.path,
      message: errItem.message,
    }));

    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      errors,
    });
  }

  // Multer Error
  if (err.name === "MulterError") {
    let message = "File upload error";
    let code = "FILE_UPLOAD_ERROR";

    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File size exceeds allowed limit";
      code = "FILE_TOO_LARGE";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message = `Unexpected upload field: ${err.field}`;
      code = "UNEXPECTED_FILE_FIELD";
    }

    error = new AppError(message, 400, code);
  }

  // JWT Errors
  if (err.name === "JsonWebTokenError") {
    error = new AppError("Invalid token", 401, "INVALID_TOKEN");
  }

  if (err.name === "TokenExpiredError") {
    error = new AppError("Token expired", 401, "TOKEN_EXPIRED");
  }

  // CORS Error
  if (err.message === "Not allowed by CORS") {
    error = new AppError("Not allowed by CORS", 403, "CORS_FORBIDDEN");
  }

  // Payload Too Large
  if (err.type === "entity.too.large") {
    error = new AppError("Request payload too large", 413, "PAYLOAD_TOO_LARGE");
  }

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    code: error.code || "INTERNAL_SERVER_ERROR",
    message:
      error.isOperational || process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong on the server",
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
    }),
  });
};

module.exports = {
  AppError,
  errorHandler,
};