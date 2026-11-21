const mongoose = require("mongoose");

const workingHoursDaySchema = new mongoose.Schema(
  {
    open: {
      type: String,
      default: null,
    },
    close: {
      type: String,
      default: null,
    },
    closed: {
      type: Boolean,
      default: false,
    },
    emergency: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const ClinicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    license_number: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
    slot_duration_minutes: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: ["USD", "EGP", "EUR", "SAR", "AED", "GBP"],
      default: "USD",
    },
    tax_note: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
    working_hours: {
      sunday: { type: workingHoursDaySchema, default: () => ({ closed: false, emergency: true }) },
      monday: { type: workingHoursDaySchema, default: () => ({ open: "08:00", close: "18:00" }) },
      tuesday: { type: workingHoursDaySchema, default: () => ({ open: "08:00", close: "18:00" }) },
      wednesday: { type: workingHoursDaySchema, default: () => ({ open: "08:00", close: "18:00" }) },
      thursday: { type: workingHoursDaySchema, default: () => ({ open: "08:00", close: "18:00" }) },
      friday: { type: workingHoursDaySchema, default: () => ({ open: "08:00", close: "18:00" }) },
      saturday: { type: workingHoursDaySchema, default: () => ({ open: "09:00", close: "14:00" }) },
    },
    owner_doctor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Clinic", ClinicSchema);
