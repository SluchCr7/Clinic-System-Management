const Joi = require("joi");
const {
  createListQuerySchema,
  objectId,
} = require("../../utils/listQuery");

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const createScheduleSchema = Joi.object({
  doctor: Joi.string()
    .hex()
    .length(24),

  dayOfWeek: Joi.number()
    .integer()
    .min(0)
    .max(6)
    .required(),

  startTime: Joi.string()
    .pattern(timeRegex)
    .required(),

  endTime: Joi.string()
    .pattern(timeRegex)
    .required(),

  breakStart: Joi.string()
    .pattern(timeRegex)
    .allow(null)
    .optional(),

  breakEnd: Joi.string()
    .pattern(timeRegex)
    .allow(null)
    .optional(),
});

const updateScheduleSchema = Joi.object({
  dayOfWeek: Joi.number()
    .integer()
    .min(0)
    .max(6),

  startTime: Joi.string()
    .pattern(timeRegex),

  endTime: Joi.string()
    .pattern(timeRegex),

  breakStart: Joi.string()
    .pattern(timeRegex)
    .allow(null),

  breakEnd: Joi.string()
    .pattern(timeRegex)
    .allow(null),

  isActive: Joi.boolean(),
}).min(1);

const scheduleListQuerySchema = createListQuerySchema({
  sortFields: [
    "doctor",
    "dayOfWeek",
    "startTime",
    "endTime",
    "createdAt",
  ],
  search: false,
  filters: {
    doctor: objectId,
    dayOfWeek: Joi.number().integer().min(0).max(6),
    isActive: Joi.boolean().truthy("true").falsy("false"),
  },
});

module.exports = {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleListQuerySchema,
};