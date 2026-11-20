const mongoose = require("mongoose");

const DoctorAssignmentSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },

    receptionist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

DoctorAssignmentSchema.index(
  { doctor: 1, receptionist: 1 },
  { unique: true }
);

DoctorAssignmentSchema.index({ receptionist: 1, isActive: 1 });
DoctorAssignmentSchema.index({ doctor: 1, isActive: 1 });

module.exports = mongoose.model(
  "DoctorAssignment",
  DoctorAssignmentSchema
);
