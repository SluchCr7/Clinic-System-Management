const Joi = require("joi");
const {
  createListQuerySchema,
} = require("../../utils/listQuery");

const objectId = Joi.string().hex().length(24);

const testSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .required(),

  code: Joi.string()
    .trim()
    .uppercase()
    .max(50)
    .optional(),

  instructions: Joi.string()
    .trim()
    .max(500)
    .optional(),
});

const statusSchema = Joi.string().valid(
  "REQUESTED",
  "RESULT_RECEIVED",
  "CANCELLED"
);

const createLabOrderSchema = Joi.object({
  type: Joi.string().valid("LAB", "IMAGING").default("LAB"),
  visit: objectId.required(),

  patient: objectId.required(),

  doctor: objectId.required(),

  tests: Joi.array()
    .items(testSchema)
    .min(1)
    .required(),

  reason: Joi.string()
    .trim()
    .max(1000)
    .optional(),

  priority: Joi.string()
    .valid("routine", "urgent", "stat")
    .default("routine"),

  notes: Joi.string()
    .trim()
    .max(2000)
    .optional(),

  instructions: Joi.string().trim().max(1000).optional(),
  clinicalNotes: Joi.string().trim().max(2000).optional(),
  expectedBy: Joi.date().optional(),

  orderedAt: Joi.date()
    .optional(),
});

const updateLabOrderSchema = Joi.object({
  tests: Joi.array()
    .items(testSchema)
    .min(1)
    .optional(),

  reason: Joi.string()
    .trim()
    .max(1000)
    .optional(),

  priority: Joi.string()
    .valid("routine", "urgent", "stat")
    .optional(),

  status: statusSchema.optional(),
  type: Joi.string().valid("LAB", "IMAGING").optional(),
  instructions: Joi.string().trim().max(1000).optional(),
  clinicalNotes: Joi.string().trim().max(2000).optional(),
  expectedBy: Joi.date().optional(),
  receivedAt: Joi.date().optional(),
  performedAt: Joi.date().optional(),
  externalFacilityName: Joi.string().trim().max(300).optional(),
  resultNotes: Joi.string().trim().max(2000).optional(),
  resultAttachment: objectId.optional(),
  reason: Joi.string().trim().max(1000).optional(),
  statusChangeReason: Joi.string().trim().max(1000).optional(),

  notes: Joi.string()
    .trim()
    .max(2000)
    .optional(),

  orderedAt: Joi.date()
    .optional(),
}).min(1);

const labOrderListQuerySchema = createListQuerySchema({
  sortFields: [
    "orderedAt",
    "priority",
    "status",
    "createdAt",
    "updatedAt",
  ],
  dateFields: true,
  filters: {
    visit: objectId,
    patient: objectId,
    doctor: objectId,
    type: Joi.string().valid("LAB", "IMAGING"),
    status: statusSchema,
    priority: Joi.string().valid("routine", "urgent", "stat"),
  },
});

module.exports = {
  createLabOrderSchema,
  updateLabOrderSchema,
  labOrderListQuerySchema,
};