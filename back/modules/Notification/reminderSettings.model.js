const mongoose = require("mongoose");

const ReminderSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ["appointment-reminders"],
      unique: true,
      default: "appointment-reminders",
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    minutesBefore: {
      type: Number,
      min: 1,
      max: 1440,
      default: 120,
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ReminderSettings",
  ReminderSettingsSchema
);
