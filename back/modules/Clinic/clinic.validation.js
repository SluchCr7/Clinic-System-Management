const Joi = require("joi");

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const workingHoursDaySchema = Joi.object({
  open: Joi.string().pattern(timePattern).allow(null).default(null),
  close: Joi.string().pattern(timePattern).allow(null).default(null),
  closed: Joi.boolean().default(false),
  emergency: Joi.boolean().default(false),
}).custom((day, helpers) => {
  if (!day.closed && day.emergency) {
    return day;
  }
  if (!day.closed && (!day.open || !day.close)) {
    return helpers.error("workingHours.incomplete");
  }
  if (!day.closed && day.open >= day.close) {
    return helpers.error("workingHours.invalidOrder");
  }
  return day;
}).messages({
  "workingHours.incomplete": "Open and close times are required when the day is not closed",
  "workingHours.invalidOrder": "Working hours open time must be before close time",
});

const updateClinicSchema = Joi.object({
  name: Joi.string().min(1).max(150).trim(),
  license_number: Joi.string().max(100).trim().allow("", null),
  slot_duration_minutes: Joi.number().integer().positive(),
  currency: Joi.string().valid("USD", "EGP", "EUR", "SAR", "AED", "GBP"),
  tax_note: Joi.string().max(300).trim().allow("", null),
  working_hours: Joi.object({
    sunday: workingHoursDaySchema,
    monday: workingHoursDaySchema,
    tuesday: workingHoursDaySchema,
    wednesday: workingHoursDaySchema,
    thursday: workingHoursDaySchema,
    friday: workingHoursDaySchema,
    saturday: workingHoursDaySchema,
  }).min(1),
}).min(1);

module.exports = { updateClinicSchema };
