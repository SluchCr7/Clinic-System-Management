const Joi = require("joi");
const {
  createListQuerySchema,
  objectId,
} = require("../../utils/listQuery");

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

  vitals: Joi.object({
    temperature: Joi.number()
      .min(25)
      .max(45),

    bloodPressure: Joi.object({
      systolic: Joi.number()
        .integer()
        .min(50)
        .max(250),

      diastolic: Joi.number()
        .integer()
        .min(30)
        .max(150),
    }),

    heartRate: Joi.number()
      .integer()
      .min(20)
      .max(250),

    respiratoryRate: Joi.number()
      .integer()
      .min(5)
      .max(60),

    oxygenSaturation: Joi.number()
      .min(50)
      .max(100),

    weight: Joi.number()
      .min(0)
      .max(500),

    height: Joi.number()
      .min(0)
      .max(300),
  }),

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

  followUpDate: Joi.date()
    .iso()
    .allow(null),
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

  vitals: Joi.object({
    temperature: Joi.number()
      .min(25)
      .max(45),

    bloodPressure: Joi.object({
      systolic: Joi.number()
        .integer()
        .min(50)
        .max(250),

      diastolic: Joi.number()
        .integer()
        .min(30)
        .max(150),
    }),

    heartRate: Joi.number()
      .integer()
      .min(20)
      .max(250),

    respiratoryRate: Joi.number()
      .integer()
      .min(5)
      .max(60),

    oxygenSaturation: Joi.number()
      .min(50)
      .max(100),

    weight: Joi.number()
      .min(0)
      .max(500),

    height: Joi.number()
      .min(0)
      .max(300),
  }),

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

  followUpDate: Joi.date()
    .iso()
    .allow(null),
}).min(1);

const visitListQuerySchema = createListQuerySchema({
  sortFields: ["createdAt", "updatedAt", "followUpDate"],
  search: false,
  filters: {
    patient: objectId,
    doctor: objectId,
  },
});

module.exports = {
  createVisitSchema,
  updateVisitSchema,
  visitListQuerySchema,
};