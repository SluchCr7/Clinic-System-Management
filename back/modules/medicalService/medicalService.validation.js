const Joi = require("joi");
const { createListQuerySchema } = require("../../utils/listQuery");

const createMedicalServiceSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .required(),

  code: Joi.string()
    .trim()
    .uppercase()
    .min(2)
    .max(50)
    .pattern(/^[A-Z0-9_-]+$/)
    .required(),

  description: Joi.string()
    .trim()
    .max(1000)
    .allow("", null),

  category: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required(),

  price: Joi.number()
    .min(0)
    .required(),

  duration: Joi.number()
    .integer()
    .min(1)
    .max(1440)
    .default(30),
});

const updateMedicalServiceSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(200),

  description: Joi.string()
    .trim()
    .max(1000)
    .allow("", null),

  category: Joi.string()
    .trim()
    .min(2)
    .max(100),

  price: Joi.number()
    .min(0),

  duration: Joi.number()
    .integer()
    .min(1)
    .max(1440),

  isActive: Joi.boolean(),
}).min(1);

const medicalServiceListQuerySchema = createListQuerySchema({
  sortFields: [
    "name",
    "code",
    "category",
    "price",
    "duration",
    "createdAt",
    "updatedAt",
  ],
  filters: {
    category: Joi.string().trim().max(100),
    isActive: Joi.boolean().truthy("true").falsy("false"),
  },
});

module.exports = {
  createMedicalServiceSchema,
  updateMedicalServiceSchema,
  medicalServiceListQuerySchema,
};