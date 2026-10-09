const Joi = require("joi");
const { createListQuerySchema } = require("../../utils/listQuery");

const objectId = Joi.string()
  .hex()
  .length(24);

const createAuditLogSchema = Joi.object({
  action: Joi.string()
    .trim()
    .uppercase()
    .valid(
      "USER_CREATED",
      "USER_UPDATED",
      "USER_DEACTIVATED",
      "PASSWORD_CHANGED",
      "PROFILE_PHOTO_UPDATED",
      "LOGIN_SUCCESS",
      "LOGIN_FAILED",
      "LOGOUT",
      "TOKEN_REFRESHED",

      "PATIENT_CREATED",
      "PATIENT_UPDATED",
      "PATIENT_DEACTIVATED",

      "DOCTOR_CREATED",
      "DOCTOR_UPDATED",
      "DOCTOR_DEACTIVATED",

      "SCHEDULE_CREATED",
      "SCHEDULE_UPDATED",
      "SCHEDULE_DEACTIVATED",

      "APPOINTMENT_CREATED",
      "APPOINTMENT_UPDATED",
      "APPOINTMENT_CANCELLED",
      "APPOINTMENT_RESCHEDULED",

      "VISIT_CREATED",
      "VISIT_UPDATED",

      "PRESCRIPTION_CREATED",
      "PRESCRIPTION_UPDATED",

      "MEDICAL_SERVICE_CREATED",
      "MEDICAL_SERVICE_UPDATED",
      "MEDICAL_SERVICE_DEACTIVATED",

      "PERFORMED_SERVICE_CREATED",
      "PERFORMED_SERVICE_UPDATED",

      "INVOICE_CREATED",
      "INVOICE_UPDATED",
      "INVOICE_CANCELLED",

      "PAYMENT_CREATED",

      "MEDICAL_ATTACHMENT_UPLOADED",
      "MEDICAL_ATTACHMENT_DELETED",

      "LAB_ORDER_CREATED",
      "LAB_ORDER_UPDATED",

      "NOTIFICATION_CREATED",
      "NOTIFICATION_READ",
      "NOTIFICATIONS_READ_ALL"
    )
    .required(),

  resource: Joi.string()
    .trim()
    .valid(
      "User",
      "Patient",
      "Doctor",
      "Schedule",
      "Appointment",
      "Visit",
      "Prescription",
      "MedicalService",
      "PerformedService",
      "Invoice",
      "Payment",
      "MedicalAttachment",
      "LabOrder",
      "Notification"
    )
    .required(),

  resourceId: objectId.optional(),

  details: Joi.object()
    .unknown(true)
    .optional(),
});

const auditLogListQuerySchema = createListQuerySchema({
  sortFields: ["createdAt", "updatedAt", "action", "resource"],
  dateFields: true,
  search: false,
  filters: {
    actor: objectId,
    action: Joi.string().trim().uppercase().max(100),
    resource: Joi.string().trim().max(100),
    resourceId: objectId,
  },
});

module.exports = {
  createAuditLogSchema,
  auditLogListQuerySchema,
};