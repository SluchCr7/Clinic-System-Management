const mongoose = require("mongoose");

const VisitSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
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

    chiefComplaint: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    symptoms: [
      {
        type: String,
        trim: true,
        maxlength: 200,
      },
    ],

    vitals: {
      temperature: {
        type: Number,
        min: 25,
        max: 45,
      },

      bloodPressure: {
        systolic: {
          type: Number,
          min: 50,
          max: 250,
        },

        diastolic: {
          type: Number,
          min: 30,
          max: 150,
        },
      },

      heartRate: {
        type: Number,
        min: 20,
        max: 250,
      },

      respiratoryRate: {
        type: Number,
        min: 5,
        max: 60,
      },

      oxygenSaturation: {
        type: Number,
        min: 50,
        max: 100,
      },

      weight: {
        type: Number,
        min: 0,
        max: 500,
      },

      height: {
        type: Number,
        min: 0,
        max: 300,
      },
    },

    examination: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    diagnosis: [
      {
        type: String,
        trim: true,
        maxlength: 500,
      },
    ],

    doctorNotes: {
      type: String,
      trim: true,
      maxlength: 3000,
    },

    followUpDate: {
      type: Date,
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

VisitSchema.index({
  patient: 1,
  createdAt: -1,
});

VisitSchema.index({
  doctor: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Visit", VisitSchema);