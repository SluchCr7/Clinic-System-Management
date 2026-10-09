const mongoose = require("mongoose");

const MedicationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    dosage: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    frequency: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    duration: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    route: {
      type: String,
      trim: true,
      enum: [
        "oral",
        "topical",
        "injection",
        "inhalation",
        "ophthalmic",
        "otic",
        "nasal",
        "rectal",
        "other",
      ],
      default: "oral",
    },

    instructions: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    _id: true,
  }
);

const PrescriptionSchema = new mongoose.Schema(
  {
    visit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      required: true,
      unique: true,
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

    medications: {
      type: [MedicationSchema],
      required: true,
      validate: {
        validator: function (medications) {
          return medications.length > 0;
        },
        message:
          "Prescription must contain at least one medication",
      },
    },

    generalInstructions: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
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

PrescriptionSchema.index({
  patient: 1,
  createdAt: -1,
});

PrescriptionSchema.index({
  doctor: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "Prescription",
  PrescriptionSchema
);