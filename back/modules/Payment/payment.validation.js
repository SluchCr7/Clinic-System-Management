const Joi = require("joi");
const {
  createListQuerySchema,
  objectId,
} = require("../../utils/listQuery");

const createPaymentSchema = Joi.object({
  invoice: Joi.string()
    .hex()
    .length(24)
    .required(),

  amount: Joi.number()
    .positive()
    .precision(2)
    .required(),

  method: Joi.string()
    .valid(
      "cash",
      "card",
      "bank_transfer",
      "online",
      "insurance"
    )
    .required(),

  transactionReference: Joi.string()
    .trim()
    .max(200)
    .allow("", null),

  notes: Joi.string()
    .trim()
    .max(1000)
    .allow("", null),

  paidAt: Joi.date()
    .iso()
    .default(() => new Date()),
});

const paymentListQuerySchema = createListQuerySchema({
  sortFields: [
    "paidAt",
    "amount",
    "method",
    "createdAt",
  ],
  dateFields: true,
  search: false,
  filters: {
    invoice: objectId,
    patient: objectId,
    method: Joi.string().valid(
      "cash",
      "card",
      "bank_transfer",
      "online",
      "insurance"
    ),
  },
});

module.exports = {
  createPaymentSchema,
  paymentListQuerySchema,
};