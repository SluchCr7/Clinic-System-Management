const mongoose = require("mongoose");

const LabOrderSchema = new mongoose.Schema(
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
      enum: [
        "ordered",
        "sample_collected",
        "processing",
        "completed",
        "cancelled",
      ],
      default: "ordered",
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

module.exports = mongoose.model("LabOrder", LabOrderSchema);