const Joi = require("joi");
const { createListQuerySchema } = require("../../utils/listQuery");

const createUserSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .required(),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .required(),

  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required(),

  password: Joi.string()
    .min(8)
    .max(100)
    .required(),

  phone: Joi.string()
    .trim()
    .required(),

  role: Joi.string()
    .valid("admin", "doctor", "receptionist")
    .required(),

  isActive: Joi.boolean()
        .optional(),
    profilePhoto: Joi.object({
    url: Joi.string().uri().allow(""),
    publicId: Joi.string().allow(null, ""),
  }).optional(),
});


const updateUserSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .trim(),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .trim(),

  email: Joi.string()
    .email()
    .lowercase()
    .trim(),

  phone: Joi.string()
    .trim(),

  role: Joi.string()
    .valid("admin", "doctor", "receptionist"),

    isActive: Joi.boolean(),
  profilePhoto: Joi.object({
    url: Joi.string().uri().allow(""),
    publicId: Joi.string().allow(null, ""),
  }),
}).min(1);

const userListQuerySchema = createListQuerySchema({
  sortFields: [
    "firstName",
    "lastName",
    "email",
    "role",
    "lastLogin",
    "createdAt",
    "updatedAt",
  ],
  filters: {
    role: Joi.string().valid("admin", "doctor", "receptionist"),
    isActive: Joi.boolean().truthy("true").falsy("false"),
  },
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
};
