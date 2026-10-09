const mongoose = require("mongoose");

const MedicalServiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    duration: {
      type: Number,
      min: 1,
      default: 30,
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

MedicalServiceSchema.index({
  category: 1,
  isActive: 1,
});

MedicalServiceSchema.index({
  name: 1,
});

module.exports = mongoose.model(
  "MedicalService",
  MedicalServiceSchema
);