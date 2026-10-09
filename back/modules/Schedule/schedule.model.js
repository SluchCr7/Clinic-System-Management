const mongoose = require("mongoose");

const ScheduleSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },

    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    breakStart: {
      type: String,
      default: null,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    breakEnd: {
      type: String,
      default: null,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },

    isActive: {
      type: Boolean,
      default: true,
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

ScheduleSchema.index(
  { doctor: 1, dayOfWeek: 1 },
  { unique: true }
);

module.exports = mongoose.model("Schedule", ScheduleSchema);