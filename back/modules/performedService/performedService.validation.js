const Joi = require("joi");
const {
  createListQuerySchema,
  objectId,
} = require("../../utils/listQuery");

const createPerformedServiceSchema = Joi.object({
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

  service: Joi.string()
    .hex()
    .length(24)
    .required(),

  quantity: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(1),

  discount: Joi.number()
    .min(0)
    .default(0),

  notes: Joi.string()
    .trim()
    .max(1000)
    .allow("", null),

  performedAt: Joi.date()
    .iso()
    .default(() => new Date()),
});

const updatePerformedServiceSchema = Joi.object({
  quantity: Joi.number()
    .integer()
    .min(1)
    .max(100),

  discount: Joi.number()
    .min(0),

  notes: Joi.string()
    .trim()
    .max(1000)
    .allow("", null),

  performedAt: Joi.date()
    .iso(),
}).min(1);

const performedServiceListQuerySchema = createListQuerySchema({
  sortFields: [
    "performedAt",
    "serviceName",
    "serviceCode",
    "price",
    "createdAt",
    "updatedAt",
  ],
  dateFields: true,
  filters: {
    patient: objectId,
    doctor: objectId,
    visit: objectId,
    service: objectId,
  },
});

module.exports = {
  createPerformedServiceSchema,
  updatePerformedServiceSchema,
  performedServiceListQuerySchema,
};