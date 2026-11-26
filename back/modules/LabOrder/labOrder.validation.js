const Joi = require("joi");
const { createListQuerySchema } = require("../../utils/listQuery");

const objectId = Joi.string().hex().length(24);

const testSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  code: Joi.string().trim().uppercase().max(50).allow("", null).optional(),
  instructions: Joi.string().trim().max(500).allow("", null).optional(),
});

const itemSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  type: Joi.string().valid("lab", "radiology", "LAB", "IMAGING").default("lab"),
  code: Joi.string().trim().uppercase().max(50).allow("", null).optional(),
  instructions: Joi.string().trim().max(500).allow("", null).optional(),
  labName: Joi.string().trim().max(300).allow("", null).optional(),
  resultNotes: Joi.string().trim().max(3000).allow("", null).optional(),
});

const statusSchema = Joi.string().valid(
  "ordered",
  "received",
  "cancelled",
  "REQUESTED",
  "RESULT_RECEIVED",
  "CANCELLED"
);

const createLabOrderSchema = Joi.object({
  visit: objectId.optional(),
  visitId: objectId.optional(),
  patient: objectId.optional(),
  patientId: objectId.optional(),
  doctor: objectId.optional(),
  type: Joi.string().valid("lab", "radiology", "LAB", "IMAGING").optional(),
  priority: Joi.string().valid("routine", "urgent", "stat").default("routine"),
  items: Joi.array().items(itemSchema).min(1).optional(),
  tests: Joi.array().items(testSchema).min(1).optional(),
  reason: Joi.string().trim().max(1000).allow("", null).optional(),
  notes: Joi.string().trim().max(2000).allow("", null).optional(),
  instructions: Joi.string().trim().max(1000).allow("", null).optional(),
  clinicalNotes: Joi.string().trim().max(2000).allow("", null).optional(),
  expectedBy: Joi.date().allow(null).optional(),
  orderedAt: Joi.date().allow(null).optional(),
}).or("visit", "visitId").or("patient", "patientId").or("items", "tests");

const updateLabOrderItemSchema = Joi.object({
  status: statusSchema.required(),
  labName: Joi.string().trim().max(300).allow("", null).optional(),
  resultNotes: Joi.string().trim().max(3000).allow("", null).optional(),
  cancelReason: Joi.string().trim().max(1000).allow("", null).optional(),
  receivedAt: Joi.date().allow(null).optional(),
});

const updateLabOrderSchema = Joi.object({
  tests: Joi.array().items(testSchema).min(1).optional(),
  items: Joi.array().items(itemSchema).min(1).optional(),
  reason: Joi.string().trim().max(1000).allow("", null).optional(),
  priority: Joi.string().valid("routine", "urgent", "stat").optional(),
  status: statusSchema.optional(),
  type: Joi.string().valid("lab", "radiology", "LAB", "IMAGING").optional(),
  instructions: Joi.string().trim().max(1000).allow("", null).optional(),
  clinicalNotes: Joi.string().trim().max(2000).allow("", null).optional(),
  expectedBy: Joi.date().allow(null).optional(),
  receivedAt: Joi.date().allow(null).optional(),
  performedAt: Joi.date().allow(null).optional(),
  externalFacilityName: Joi.string().trim().max(300).allow("", null).optional(),
  labName: Joi.string().trim().max(300).allow("", null).optional(),
  resultNotes: Joi.string().trim().max(3000).allow("", null).optional(),
  resultAttachment: objectId.allow(null).optional(),
  statusChangeReason: Joi.string().trim().max(1000).allow("", null).optional(),
  cancelReason: Joi.string().trim().max(1000).allow("", null).optional(),
  notes: Joi.string().trim().max(2000).allow("", null).optional(),
  orderedAt: Joi.date().allow(null).optional(),
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
    visitId: objectId,
    patient: objectId,
    patientId: objectId,
    doctor: objectId,
    type: Joi.string().valid("lab", "radiology", "LAB", "IMAGING"),
    status: statusSchema,
    priority: Joi.string().valid("routine", "urgent", "stat"),
  },
});

const groupedLabOrdersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  filter: Joi.string().valid("pending", "all").default("pending"),
  status: Joi.string().valid("ordered", "received", "cancelled", "all").optional(),
  type: Joi.string().valid("lab", "radiology", "all").optional(),
  priority: Joi.string().valid("routine", "urgent", "all").optional(),
  search: Joi.string().trim().max(100).allow("").optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  date: Joi.string().isoDate().optional(),
});

module.exports = {
  createLabOrderSchema,
  updateLabOrderItemSchema,
  updateLabOrderSchema,
  labOrderListQuerySchema,
  groupedLabOrdersQuerySchema,
};
