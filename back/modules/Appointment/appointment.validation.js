const Joi = require("joi");
const {
  createListQuerySchema,
  objectId,
} = require("../../utils/listQuery");

const createAppointmentSchema = Joi.object({
  patient: Joi.string()
    .hex()
    .length(24)
    .required(),

  doctor: Joi.string()
    .hex()
    .length(24)
    .required(),

  appointmentDate: Joi.date()
    .iso()
    .required(),

  duration: Joi.number()
    .integer()
    .min(5)
    .max(240)
    .default(30),

  reason: Joi.string()
    .trim()
    .max(500)
    .allow("", null),

  notes: Joi.string()
    .trim()
    .max(1000)
    .allow("", null),
});

const updateAppointmentSchema = Joi.object({
  appointmentDate: Joi.date()
    .iso(),

  duration: Joi.number()
    .integer()
    .min(5)
    .max(240),

  reason: Joi.string()
    .trim()
    .max(500)
    .allow("", null),

  notes: Joi.string()
    .trim()
    .max(1000)
    .allow("", null),

  status: Joi.string()
    .valid(
      "scheduled",
      "confirmed",
      "checked_in",
      "in_progress",
      "completed",
      "cancelled",
      "no-show"
    ),

  cancellationReason: Joi.string()
    .trim()
    .max(500)
    .allow("", null),
}).min(1);

const appointmentListQuerySchema = createListQuerySchema({
  sortFields: [
    "appointmentDate",
    "status",
    "createdAt",
    "updatedAt",
  ],
  dateFields: true,
  search: false,
  filters: {
    patient: objectId,
    doctor: objectId,
    status: Joi.string().valid(
      "scheduled",
      "confirmed",
      "checked_in",
      "in_progress",
      "completed",
      "cancelled",
      "no-show"
    ),
  },
});

module.exports = {
  createAppointmentSchema,
  updateAppointmentSchema,
  appointmentListQuerySchema,
};