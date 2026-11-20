const mongoose = require("mongoose");
const { getNoShowEligibleAt } = require("../../utils/appointmentLifecycle");

const AppointmentSchema = new mongoose.Schema(
  {
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

    appointmentDate: {
      type: Date,
      required: true,
    },

    duration: {
      type: Number,
      required: true,
      min: 5,
      default: 30,
    },

    status: {
      type: String,
      enum: [
        "scheduled",
        "confirmed",
        "checked_in",
        "in_progress",
        "completed",
        "cancelled",
        "no-show",
      ],
      default: "scheduled",
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    statusHistory: {
      type: [
        {
          from: {
            type: String,
            enum: [
              "scheduled",
              "confirmed",
              "checked_in",
              "in_progress",
              "completed",
              "cancelled",
              "no-show",
              null,
            ],
            default: null,
          },
          to: {
            type: String,
            enum: [
              "scheduled",
              "confirmed",
              "checked_in",
              "in_progress",
              "completed",
              "cancelled",
              "no-show",
            ],
            required: true,
          },
          changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
          },
          changedAt: {
            type: Date,
            required: true,
          },
          reason: {
            type: String,
            trim: true,
            maxlength: 500,
          },
        },
      ],
      default: [],
    },

    confirmedAt: {
      type: Date,
      default: null,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    startedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    noShowAt: {
      type: Date,
      default: null,
    },
    noShowBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    noShowMethod: {
      type: String,
      enum: ["manual", "automatic"],
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
    reminderSent: {
      type: Boolean,
      default: false,
    },

    isFollowUp: {
      type: Boolean,
      default: false,
    },

    followUpReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    originatingVisit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      default: null,
    },

    followUpOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AppointmentSchema.virtual("noShowEligibleAt").get(function () {
  if (!this.appointmentDate) {
    return null;
  }

  return getNoShowEligibleAt(this.appointmentDate);
});

AppointmentSchema.index({
  doctor: 1,
  appointmentDate: 1,
});

AppointmentSchema.index({
  patient: 1,
  appointmentDate: 1,
});

AppointmentSchema.index({
  status: 1,
  reminderSent: 1,
  appointmentDate: 1,
});

module.exports = mongoose.model("Appointment", AppointmentSchema);