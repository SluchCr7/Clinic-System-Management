const Joi = require("joi");

const createPaymentMethodSchema = Joi.object({
  code: Joi.string()
    .trim()
    .lowercase()
    .regex(/^[a-z0-9_]+$/)
    .max(50)
    .required()
    .messages({
      "string.pattern.base": "كود طريقة الدفع يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطة سفلية فقط",
      "any.required": "كود طريقة الدفع مطلوب",
    }),

  nameAr: Joi.string()
    .trim()
    .max(100)
    .required()
    .messages({
      "any.required": "الاسم باللغة العربية مطلوب",
    }),

  nameEn: Joi.string()
    .trim()
    .max(100)
    .required()
    .messages({
      "any.required": "الاسم باللغة الإنجليزية مطلوب",
    }),

  requiresReference: Joi.boolean().default(false),

  isActive: Joi.boolean().default(true),

  isDefault: Joi.boolean().default(false),

  sortOrder: Joi.number().integer().min(0).default(0),
});

const updatePaymentMethodSchema = Joi.object({
  nameAr: Joi.string().trim().max(100),
  nameEn: Joi.string().trim().max(100),
  requiresReference: Joi.boolean(),
  isActive: Joi.boolean(),
  isDefault: Joi.boolean(),
  sortOrder: Joi.number().integer().min(0),
}).min(1);

module.exports = {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
};
