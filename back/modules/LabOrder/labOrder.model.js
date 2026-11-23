const mongoose = require("mongoose");

const LabOrderSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["LAB", "IMAGING"],
      default: "LAB",
      required: true,
      index: true,
    },

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

    tests: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
          maxlength: 200,
        },

        code: {
          type: String,
          trim: true,
          uppercase: true,
          maxlength: 50,
        },

        instructions: {
          type: String,
          trim: true,
          maxlength: 500,
        },
      },
    ],

    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    priority: {
      type: String,
      enum: ["routine", "urgent", "stat"],
      default: "routine",
      required: true,
    },

    status: {
      type: String,
      enum: ["REQUESTED", "RESULT_RECEIVED", "CANCELLED"],
      default: "REQUESTED",
      required: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    orderedAt: {
      type: Date,
      default: Date.now,
    },

    requestedAt: {
      type: Date,
      default: null,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    instructions: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    clinicalNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },

    expectedBy: {
      type: Date,
      default: null,
    },

    receivedAt: {
      type: Date,
      default: null,
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    performedAt: {
      type: Date,
      default: null,
    },

    externalFacilityName: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    resultNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },

    statusChangeReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    resultAttachment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalAttachment",
      default: null,
    },

    legacyStatus: {
      type: String,
      trim: true,
      default: null,
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

LabOrderSchema.index({
  patient: 1,
  createdAt: -1,
});

LabOrderSchema.index({
  doctor: 1,
  createdAt: -1,
});

LabOrderSchema.index({
  visit: 1,
});

LabOrderSchema.index({
  status: 1,
});

LabOrderSchema.index({ status: 1, patient: 1, visit: 1 });
LabOrderSchema.index({ type: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("LabOrder", LabOrderSchema);