const mongoose = require("mongoose");

const DoctorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    specialization: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 50,
    },

    consultationFee: {
      type: Number,
      required: true,
      min: 0,
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    yearsOfExperience: {
      type: Number,
      min: 0,
      max: 70,
      default: 0,
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
    },
  },
  {
    timestamps: true,
  }
);

DoctorSchema.index({
  isActive: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Doctor", DoctorSchema);