const mongoose = require("mongoose");

const VisitStatusHistorySchema = new mongoose.Schema(
  {
    from: {
      type: String,
      enum: ["in_progress", "completed", null],
      default: null,
    },
    to: {
      type: String,
      enum: ["in_progress", "completed"],
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

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

    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "completed",
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    statusHistory: {
      type: [VisitStatusHistorySchema],
      default: [],
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
        min: 0.1,
        max: 500,
      },

      height: {
        type: Number,
        min: 1,
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

    followUpReason: {
      type: String,
      trim: true,
      maxlength: 500,
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

VisitSchema.pre("validate", function () {
  const bloodPressure = this.vitals?.bloodPressure;
  if (!bloodPressure) return;

  const hasSystolic = bloodPressure.systolic !== undefined;
  const hasDiastolic = bloodPressure.diastolic !== undefined;

  if (hasSystolic !== hasDiastolic) {
    this.invalidate(
      "vitals.bloodPressure",
      "Both systolic and diastolic blood pressure are required together"
    );
  } else if (
    hasSystolic &&
    bloodPressure.systolic <= bloodPressure.diastolic
  ) {
    this.invalidate(
      "vitals.bloodPressure",
      "Systolic blood pressure must be greater than diastolic"
    );
  }
});

module.exports = mongoose.model("Visit", VisitSchema);