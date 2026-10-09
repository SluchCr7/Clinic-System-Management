const mongoose = require("mongoose");

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

AppointmentSchema.index({
  doctor: 1,
  appointmentDate: 1,
});

AppointmentSchema.index({
  patient: 1,
  appointmentDate: 1,
});

module.exports = mongoose.model("Appointment", AppointmentSchema);