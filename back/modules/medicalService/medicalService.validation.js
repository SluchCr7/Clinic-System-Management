const Joi = require("joi");
const { createListQuerySchema } = require("../../utils/listQuery");

const createMedicalServiceSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .required()
    .messages({
      "string.base": "اسم الخدمة يجب أن يكون نصاً",
      "string.empty": "اسم الخدمة مطلوب",
      "string.min": "اسم الخدمة يجب أن يكون حرفين على الأقل",
      "string.max": "اسم الخدمة لا يمكن أن يتجاوز 200 حرف",
      "any.required": "اسم الخدمة مطلوب",
    }),

  code: Joi.string()
    .trim()
    .uppercase()
    .min(2)
    .max(50)
    .pattern(/^[A-Z0-9_-]+$/)
    .required()
    .messages({
      "string.base": "كود الخدمة يجب أن يكون نصاً",
      "string.empty": "كود الخدمة مطلوب",
      "string.min": "كود الخدمة يجب أن يكون حرفين على الأقل",
      "string.max": "كود الخدمة لا يمكن أن يتجاوز 50 حرفاً",
      "string.pattern.base":
        "كود الخدمة يجب أن يحتوي فقط على أحرف إنجليزية وأرقام وشرطات",
      "any.required": "كود الخدمة مطلوب",
    }),

  description: Joi.string()
    .trim()
    .max(1000)
    .allow("", null)
    .messages({
      "string.max": "وصف الخدمة لا يمكن أن يتجاوز 1000 حرف",
    }),

  category: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      "string.empty": "فئة الخدمة مطلوبة",
      "string.max": "فئة الخدمة لا يمكن أن تتجاوز 100 حرف",
      "any.required": "فئة الخدمة مطلوبة",
    }),

  price: Joi.number()
    .min(0)
    .required()
    .messages({
      "number.base": "سعر الخدمة يجب أن يكون رقماً",
      "number.min": "سعر الخدمة لا يمكن أن يكون سالباً",
      "any.required": "سعر الخدمة مطلوب",
    }),

  duration: Joi.number()
    .integer()
    .min(1)
    .max(600)
    .default(30)
    .messages({
      "number.base": "مدة الخدمة يجب أن تكون رقماً صحيحاً",
      "number.min": "مدة الخدمة يجب أن تكون دقيقة واحدة على الأقل",
      "number.max": "مدة الخدمة لا يمكن أن تتجاوز 600 دقيقة",
    }),

  notes: Joi.string()
    .trim()
    .max(1000)
    .allow("", null),

  isActive: Joi.boolean().default(true),

  doctor: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
});

const updateMedicalServiceSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .messages({
      "string.empty": "اسم الخدمة لا يمكن أن يكون فارغاً",
      "string.min": "اسم الخدمة يجب أن يكون حرفين على الأقل",
      "string.max": "اسم الخدمة لا يمكن أن يتجاوز 200 حرف",
    }),

  code: Joi.string()
    .trim()
    .uppercase()
    .min(2)
    .max(50)
    .pattern(/^[A-Z0-9_-]+$/)
    .messages({
      "string.empty": "كود الخدمة لا يمكن أن يكون فارغاً",
      "string.min": "كود الخدمة يجب أن يكون حرفين على الأقل",
      "string.max": "كود الخدمة لا يمكن أن يتجاوز 50 حرفاً",
      "string.pattern.base":
        "كود الخدمة يجب أن يحتوي فقط على أحرف إنجليزية وأرقام وشرطات",
    }),

  description: Joi.string()
    .trim()
    .max(1000)
    .allow("", null)
    .messages({
      "string.max": "وصف الخدمة لا يمكن أن يتجاوز 1000 حرف",
    }),

  category: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .messages({
      "string.empty": "فئة الخدمة لا يمكن أن تكون فارغة",
      "string.max": "فئة الخدمة لا يمكن أن تتجاوز 100 حرف",
    }),

  price: Joi.number()
    .min(0)
    .messages({
      "number.base": "سعر الخدمة يجب أن يكون رقماً",
      "number.min": "سعر الخدمة لا يمكن أن يكون سالباً",
    }),

  duration: Joi.number()
    .integer()
    .min(1)
    .max(600)
    .messages({
      "number.base": "مدة الخدمة يجب أن تكون رقماً صحيحاً",
      "number.min": "مدة الخدمة يجب أن تكون دقيقة واحدة على الأقل",
      "number.max": "مدة الخدمة لا يمكن أن تتجاوز 600 دقيقة",
    }),

  notes: Joi.string()
    .trim()
    .max(1000)
    .allow("", null),

  isActive: Joi.boolean(),

  doctor: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
}).min(1);

const medicalServiceListQuerySchema = createListQuerySchema({
  sortFields: [
    "name",
    "code",
    "category",
    "price",
    "duration",
    "isActive",
    "createdAt",
    "updatedAt",
  ],
  filters: {
    category: Joi.string().trim().max(100),
    isActive: Joi.boolean().truthy("true").falsy("false"),
    doctor: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
  },
});

module.exports = {
  createMedicalServiceSchema,
  updateMedicalServiceSchema,
  medicalServiceListQuerySchema,
};
