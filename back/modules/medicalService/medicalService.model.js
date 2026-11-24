const mongoose = require("mongoose");

const roundMoney = (val) => {
  if (typeof val !== "number" || isNaN(val)) return val;
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

const PriceHistorySchema = new mongoose.Schema(
  {
    price: {
      type: Number,
      required: true,
      min: 0,
      set: roundMoney,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false }
);

const MedicalServiceSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

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
      set: roundMoney,
    },

    duration: {
      type: Number,
      min: 1,
      max: 600,
      default: 30,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    priceHistory: {
      type: [PriceHistorySchema],
      default: [],
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

MedicalServiceSchema.pre("validate", function () {
  if (!this.doctor && this.createdBy) {
    this.doctor = this.createdBy;
  }
});

MedicalServiceSchema.index({ doctor: 1, code: 1 }, { unique: true });
MedicalServiceSchema.index({ doctor: 1, category: 1, isActive: 1 });
MedicalServiceSchema.index({ doctor: 1, name: 1 });
MedicalServiceSchema.index({ name: "text", code: "text" });

module.exports = mongoose.model(
  "MedicalService",
  MedicalServiceSchema
);
