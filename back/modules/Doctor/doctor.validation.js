const Joi = require("joi");
const { createListQuerySchema } = require("../../utils/listQuery");

const createDoctorSchema = Joi.object({
  user: Joi.string().hex().length(24).required(),

  specialization: Joi.string()
    .min(2)
    .max(100)
    .trim()
    .required(),

  licenseNumber: Joi.string()
    .max(50)
    .trim()
    .required(),

  consultationFee: Joi.number()
    .min(0)
    .required(),

  bio: Joi.string()
    .max(1000)
    .trim()
    .allow("", null),

  yearsOfExperience: Joi.number()
    .integer()
    .min(0)
    .max(70)
    .default(0),


});

const updateDoctorSchema = Joi.object({
  specialization: Joi.string()
    .min(2)
    .max(100)
    .trim(),

  licenseNumber: Joi.string()
    .max(50)
    .trim(),

  consultationFee: Joi.number()
    .min(0),

  bio: Joi.string()
    .max(1000)
    .trim()
    .allow("", null),

  yearsOfExperience: Joi.number()
    .integer()
    .min(0)
    .max(70),

  
}).min(1);

const doctorListQuerySchema = createListQuerySchema({
  sortFields: [
    "specialization",
    "licenseNumber",
    "consultationFee",
    "yearsOfExperience",
    "createdAt",
    "updatedAt",
  ],
  filters: {
    specialization: Joi.string().trim().max(100),
    isActive: Joi.boolean().truthy("true").falsy("false"),
  },
});

module.exports = {
  createDoctorSchema,
  updateDoctorSchema,
  doctorListQuerySchema,
};