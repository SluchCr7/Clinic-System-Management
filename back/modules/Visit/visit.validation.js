const Joi = require("joi");
const {
  createListQuerySchema,
  objectId,
} = require("../../utils/listQuery");

const bloodPressureSchema = Joi.object({
  systolic: Joi.number().integer().min(50).max(250),
  diastolic: Joi.number().integer().min(30).max(150),
})
  .and("systolic", "diastolic")
  .custom((bloodPressure, helpers) => {
    if (
      bloodPressure.systolic !== undefined &&
      bloodPressure.diastolic !== undefined &&
      bloodPressure.systolic <= bloodPressure.diastolic
    ) {
      return helpers.error("bloodPressure.order");
    }

    return bloodPressure;
  })
  .messages({
    "bloodPressure.order":
      "Systolic blood pressure must be greater than diastolic",
  });

const vitalsSchema = Joi.object({
  temperature: Joi.number().min(25).max(45),
  bloodPressure: bloodPressureSchema,
  heartRate: Joi.number().integer().min(20).max(250),
  respiratoryRate: Joi.number().integer().min(5).max(60),
  oxygenSaturation: Joi.number().min(50).max(100),
  weight: Joi.number().min(0.1).max(500),
  height: Joi.number().min(1).max(300),
});

const followUpDateSchema = Joi.date().iso().greater("now").allow("", null);

const createVisitSchema = Joi.object({
  appointment: Joi.string()
    .hex()
    .length(24)
    .required(),

  patient: Joi.string()
    .hex()
    .length(24)
    .required(),

  doctor: Joi.string()
    .hex()
    .length(24)
    .required(),

  chiefComplaint: Joi.string()
    .trim()
    .min(2)
    .max(500)
    .required(),

  symptoms: Joi.array()
    .items(
      Joi.string()
        .trim()
        .max(200)
    )
    .max(50)
    .default([]),

  vitals: vitalsSchema,

  examination: Joi.string()
    .trim()
    .max(2000)
    .allow("", null),

  diagnosis: Joi.array()
    .items(
      Joi.string()
        .trim()
        .max(500)
    )
    .max(20)
    .default([]),

  doctorNotes: Joi.string()
    .trim()
    .max(3000)
    .allow("", null),

  followUpDate: followUpDateSchema,

  followUpDuration: Joi.number()
    .integer()
    .min(5)
    .max(240)
    .default(30),

  bookFollowUp: Joi.boolean().default(false),

  followUpReason: Joi.string()
    .trim()
    .max(500)
    .allow("", null),
});

const updateVisitSchema = Joi.object({
  chiefComplaint: Joi.string()
    .trim()
    .min(2)
    .max(500),

  symptoms: Joi.array()
    .items(
      Joi.string()
        .trim()
        .max(200)
    )
    .max(50),

  vitals: vitalsSchema,

  examination: Joi.string()
    .trim()
    .max(2000)
    .allow("", null),

  diagnosis: Joi.array()
    .items(
      Joi.string()
        .trim()
        .max(500)
    )
    .max(20),

  doctorNotes: Joi.string()
    .trim()
    .max(3000)
    .allow("", null),

  followUpDate: followUpDateSchema,

  followUpDuration: Joi.number()
    .integer()
    .min(5)
    .max(240),

  followUpReason: Joi.string()
    .trim()
    .max(500)
    .allow("", null),
}).min(1);

const visitListQuerySchema = createListQuerySchema({
  sortFields: ["createdAt", "updatedAt", "followUpDate"],
  search: false,
  filters: {
    patient: objectId,
    doctor: objectId,
    appointment: objectId,
    status: Joi.string().valid("in_progress", "completed"),
  },
});

module.exports = {
  createVisitSchema,
  updateVisitSchema,
  visitListQuerySchema,
};