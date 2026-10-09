const Joi = require("joi");
const {
  createListQuerySchema,
  objectId,
} = require("../../utils/listQuery");

const medicationSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .required(),

  dosage: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required(),

  frequency: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required(),

  duration: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required(),

  route: Joi.string()
    .valid(
      "oral",
      "topical",
      "injection",
      "inhalation",
      "ophthalmic",
      "otic",
      "nasal",
      "rectal",
      "other"
    )
    .default("oral"),

  instructions: Joi.string()
    .trim()
    .max(500)
    .allow("", null),
});

const createPrescriptionSchema = Joi.object({
  visit: Joi.string()
    .hex()
    .length(24)
    .required(),

  patient: Joi.string()
    .hex()
    .length(24)
    .required(),

  doctor: Joi.string()
    .hex()
    .length(24)
    .required(),

  medications: Joi.array()
    .items(medicationSchema)
    .min(1)
    .max(50)
    .required(),

  generalInstructions: Joi.string()
    .trim()
    .max(2000)
    .allow("", null),

  notes: Joi.string()
    .trim()
    .max(2000)
    .allow("", null),
});

const updatePrescriptionSchema = Joi.object({
  medications: Joi.array()
    .items(medicationSchema)
    .min(1)
    .max(50),

  generalInstructions: Joi.string()
    .trim()
    .max(2000)
    .allow("", null),

  notes: Joi.string()
    .trim()
    .max(2000)
    .allow("", null),
}).min(1);

const prescriptionListQuerySchema = createListQuerySchema({
  sortFields: ["createdAt", "updatedAt"],
  search: false,
  filters: {
    patient: objectId,
    doctor: objectId,
    visit: objectId,
  },
});

module.exports = {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  prescriptionListQuerySchema,
};