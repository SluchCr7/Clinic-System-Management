const Joi = require("joi");
const {
  createListQuerySchema,
  objectId,
} = require("../../utils/listQuery");

const serviceItemSchema = Joi.object({
  serviceId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).default(1),
  discount: Joi.number().min(0).default(0),
});

const createInvoiceSchema = Joi.object({
  visit: Joi.string()
    .hex()
    .length(24)
    .required(),

  services: Joi.array().items(serviceItemSchema).optional(),

  discount: Joi.number()
    .min(0)
    .default(0),

  tax: Joi.number()
    .min(0)
    .default(0),

  notes: Joi.string()
    .trim()
    .max(2000)
    .allow("", null),
});

const updateInvoiceSchema = Joi.object({
  services: Joi.array().items(serviceItemSchema).optional(),

  discount: Joi.number()
    .min(0),

  tax: Joi.number()
    .min(0),

  notes: Joi.string()
    .trim()
    .max(2000)
    .allow("", null),
}).min(1);

const invoiceListQuerySchema = createListQuerySchema({
  sortFields: [
    "invoiceNumber",
    "issuedAt",
    "total",
    "status",
    "createdAt",
    "updatedAt",
  ],
  dateFields: true,
  filters: {
    patient: objectId,
    doctor: objectId,
    visit: objectId,
    status: Joi.string().valid(
      "unpaid",
      "partially_paid",
      "paid",
      "cancelled"
    ),
  },
});

const eligibleVisitListQuerySchema = createListQuerySchema({
  sortFields: ["createdAt"],
  search: false,
});

module.exports = {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceListQuerySchema,
  eligibleVisitListQuerySchema,
};
