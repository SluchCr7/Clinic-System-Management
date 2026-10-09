const Joi = require("joi");

const dashboardReportQuerySchema = Joi.object({
  period: Joi.string()
    .valid("today", "week", "month", "year", "custom")
    .default("month"),
  startDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .when("period", {
      is: "custom",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  endDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .when("period", {
      is: "custom",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
});

module.exports = {
  dashboardReportQuerySchema,
};
