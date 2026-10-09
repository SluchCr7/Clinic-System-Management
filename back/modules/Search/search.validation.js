const Joi = require("joi");

const globalSearchQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).max(100).required(),
  limit: Joi.number().integer().min(1).max(10).default(5),
}).unknown(false);

module.exports = { globalSearchQuerySchema };
