const Joi = require("joi")
const { createListQuerySchema } = require("../../utils/listQuery");

const createPatientSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).trim().required(),

  lastName: Joi.string().min(2).max(50).trim().required(),

  dateOfBirth: Joi.date().max("now").required(),

  gender: Joi.string().valid("male", "female").required(),

  phone: Joi.string().trim().required(),

  email: Joi.string().email().lowercase().trim().allow("", null),

  bloodType: Joi.string().valid(
    "A+",
    "A-",
    "B+",
    "B-",
    "AB+",
    "AB-",
    "O+",
    "O-"
  ),

  allergies: Joi.array().items(Joi.string().trim()).default([]),

  chronicDiseases: Joi.array().items(Joi.string().trim()).default([]),

  address: Joi.object({
    street: Joi.string().trim(),
    city: Joi.string().trim(),
    country: Joi.string().trim(),
  }).optional(),

  emergencyContact: Joi.object({
    name: Joi.string().trim(),
    phone: Joi.string().trim(),
    relationship: Joi.string().trim(),
  }).optional(),
});


const updatePatientSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .trim(),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .trim(),

  dateOfBirth: Joi.date()
    .max("now"),

  gender: Joi.string()
    .valid("male", "female"),

  phone: Joi.string()
    .trim(),

  email: Joi.string()
    .email()
    .lowercase()
    .trim(),

  bloodType: Joi.string()
    .valid(
      "A+",
      "A-",
      "B+",
      "B-",
      "AB+",
      "AB-",
      "O+",
      "O-"
    ),

  allergies: Joi.array()
    .items(Joi.string().trim()),

  chronicDiseases: Joi.array()
    .items(Joi.string().trim()),

  address: Joi.object({
    street: Joi.string().trim(),
    city: Joi.string().trim(),
    country: Joi.string().trim(),
  }),

  emergencyContact: Joi.object({
    name: Joi.string().trim(),
    phone: Joi.string().trim(),
    relationship: Joi.string().trim(),
  }),
}).min(1);

const patientListQuerySchema = createListQuerySchema({
  sortFields: [
    "firstName",
    "lastName",
    "dateOfBirth",
    "createdAt",
    "updatedAt",
  ],
  filters: {
    gender: Joi.string().valid("male", "female"),
    bloodType: Joi.string().valid(
      "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"
    ),
    isActive: Joi.boolean().truthy("true").falsy("false"),
  },
});

module.exports = {
  createPatientSchema,
  updatePatientSchema,
  patientListQuerySchema,
};
