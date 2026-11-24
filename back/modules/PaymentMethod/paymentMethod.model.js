const mongoose = require("mongoose");

const PaymentMethodSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Payment method code is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 50,
    },

    nameAr: {
      type: String,
      required: [true, "Arabic name is required"],
      trim: true,
      maxlength: 100,
    },

    nameEn: {
      type: String,
      required: [true, "English name is required"],
      trim: true,
      maxlength: 100,
    },

    requiresReference: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique default method with a partial unique index
PaymentMethodSchema.index(
  { isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true },
  }
);

PaymentMethodSchema.index({
  sortOrder: 1,
  isActive: 1,
});

module.exports = mongoose.model("PaymentMethod", PaymentMethodSchema);
