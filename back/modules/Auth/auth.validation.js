const Joi = require("joi");

const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required(),

  password: Joi.string()
    .required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required(),

  newPassword: Joi.string()
    .min(8)
    .max(100)
    .required(),

  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
    }),
});

module.exports = {
  loginSchema,
  changePasswordSchema,
};