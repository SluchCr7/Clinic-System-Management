const Joi = require("joi");
const { createListQuerySchema } = require("../../utils/listQuery");

const objectId = Joi.string()
  .hex()
  .length(24);

const createNotificationSchema = Joi.object({
  recipient: objectId.required(),

  type: Joi.string()
    .valid(
      "appointment",
      "lab_order",
      "payment",
      "prescription",
      "medical_attachment",
      "visit_completed",
      "lab_result",
      "lab_cancelled",
      "system"
    )
    .required(),

  title: Joi.string()
    .trim()
    .min(2)
    .max(200)
    .required(),

  message: Joi.string()
    .trim()
    .min(2)
    .max(1000)
    .required(),

  relatedModel: Joi.string()
    .valid(
      "Appointment",
      "LabOrder",
      "Payment",
      "Prescription",
      "MedicalAttachment",
      "Visit"
    )
    .optional(),

  relatedId: objectId.optional(),
  actor: objectId.optional(),
  entityType: Joi.string().trim().max(100).optional(),
  entityId: objectId.optional(),
  link: Joi.string().trim().max(500).optional(),
  priority: Joi.string().valid("low", "medium", "high").optional(),
});

const markAsReadSchema = Joi.object({
  isRead: Joi.boolean()
    .valid(true)
    .required(),
});

const notificationListQuerySchema = createListQuerySchema({
  sortFields: ["createdAt", "updatedAt", "readAt", "type"],
  filters: {
    isRead: Joi.boolean().truthy("true").falsy("false"),
    type: Joi.string().valid(
      "appointment",
      "lab_order",
      "payment",
      "prescription",
      "medical_attachment",
      "visit_completed",
      "lab_result",
      "lab_cancelled",
      "system"
    ),
  },
});

const reminderSettingsSchema = Joi.object({
  enabled: Joi.boolean().required(),
  minutesBefore: Joi.number().integer().min(1).max(1440).required(),
});

module.exports = {
  createNotificationSchema,
  markAsReadSchema,
  notificationListQuerySchema,
  reminderSettingsSchema,
};