const Joi = require("joi");
const {
  createListQuerySchema,
  objectId,
} = require("../../utils/listQuery");

const createPaymentSchema = Joi.object({
  invoice: Joi.string()
    .hex()
    .length(24),

  amount: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      "number.positive": "مبلغ الدفع يجب أن يكون أكبر من 0",
      "any.required": "مبلغ الدفع مطلوب",
    }),

  paymentMethod: Joi.string()
    .trim()
    .allow("", null),

  method: Joi.string()
    .trim()
    .lowercase()
    .allow("", null),

  referenceNumber: Joi.string()
    .trim()
    .max(200)
    .allow("", null),

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
    .allow(null),

  idempotencyKey: Joi.string()
    .trim()
    .max(100)
    .allow("", null),
});

const reversePaymentSchema = Joi.object({
  reason: Joi.string()
    .trim()
    .min(3)
    .max(500)
    .required()
    .messages({
      "string.min": "سبب إلغاء/عكس الدفعة يجب ألا يقل عن 3 أحرف",
      "any.required": "سبب إلغاء/عكس الدفعة مطلوب",
    }),
});

const paymentListQuerySchema = createListQuerySchema({
  sortFields: [
    "paidAt",
    "amount",
    "method",
    "paymentMethod",
    "createdAt",
  ],
  dateFields: true,
  search: false,
  filters: {
    invoice: objectId,
    patient: objectId,
    paymentMethod: objectId,
    receivedBy: objectId,
    method: Joi.string().trim().lowercase(),
  },
});

module.exports = {
  createPaymentSchema,
  reversePaymentSchema,
  paymentListQuerySchema,
};
