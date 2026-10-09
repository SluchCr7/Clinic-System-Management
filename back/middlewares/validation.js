const mongoose = require("mongoose");
const { AppError } = require("./errorHandler");

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Validation error",
        errors: error.details.map((err) => err.message),
      });
    }

    req.body = value;

    next();
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      convert: true,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Validation error",
        errors: error.details.map((err) => err.message),
      });
    }

    req.query = value;
    req.validatedQuery = value;
    next();
  };
};

const validateId = (paramName = "id", entityName = "ID") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (
      !id ||
      !mongoose.Types.ObjectId.isValid(id) ||
      String(new mongoose.Types.ObjectId(id)) !== id
    ) {
      return next(new AppError(`Invalid ${entityName}`, 400, "INVALID_ID"));
    }
    next();
  };
};

const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ID",
        message: "Invalid parameter",
        errors: error.details.map((err) => err.message),
      });
    }

    req.params = value;
    next();
  };
};

module.exports = validate;
module.exports.validate = validate;
module.exports.validateQuery = validateQuery;
module.exports.validateId = validateId;
module.exports.validateParams = validateParams;