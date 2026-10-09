const Joi = require("joi");
const {
  createListQuerySchema,
  objectId,
} = require("../../utils/listQuery");

const attachmentTypes = [
  "lab_report",
  "xray",
  "prescription",
  "medical_report",
  "other",
];

const createMedicalAttachmentSchema = Joi.object({
  patient: Joi.string()
    .hex()
    .length(24)
    .required(),

  visit: Joi.string()
    .hex()
    .length(24)
    .allow(null, ""),

  type: Joi.string()
    .valid(...attachmentTypes)
    .required(),

  title: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .required(),

  description: Joi.string()
    .trim()
    .max(1000)
    .allow("", null),
});

const medicalAttachmentListQuerySchema = createListQuerySchema({
  sortFields: ["createdAt", "updatedAt", "title", "type"],
  filters: {
    patient: objectId.required(),
    visit: objectId,
    type: Joi.string().valid(...attachmentTypes),
  },
});

module.exports = {
  createMedicalAttachmentSchema,
  medicalAttachmentListQuerySchema,
};