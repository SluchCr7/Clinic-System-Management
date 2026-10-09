const mongoose = require("mongoose");

const PerformedServiceSchema = new mongoose.Schema(
  {
    visit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      required: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalService",
      required: true,
    },

    serviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    serviceCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    discount: {
      type: Number,
      min: 0,
      default: 0,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    performedAt: {
      type: Date,
      default: Date.now,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

PerformedServiceSchema.index({
  visit: 1,
  createdAt: -1,
});

PerformedServiceSchema.index({
  patient: 1,
  createdAt: -1,
});

PerformedServiceSchema.index({
  doctor: 1,
  createdAt: -1,
});

PerformedServiceSchema.index({
  service: 1,
});

module.exports = mongoose.model(
  "PerformedService",
  PerformedServiceSchema
);