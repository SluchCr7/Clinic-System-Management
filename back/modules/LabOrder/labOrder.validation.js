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

const createLabOrderSchema = Joi.object({
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

  status: Joi.string()
    .valid(
      "ordered",
      "sample_collected",
      "processing",
      "completed",
      "cancelled"
    )
    .optional(),

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
    status: Joi.string().valid(
      "ordered",
      "sample_collected",
      "processing",
      "completed",
      "cancelled"
    ),
    priority: Joi.string().valid("routine", "urgent", "stat"),
  },
});

module.exports = {
  createLabOrderSchema,
  updateLabOrderSchema,
  labOrderListQuerySchema,
};