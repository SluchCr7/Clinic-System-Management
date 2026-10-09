const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    method: {
      type: String,
      enum: [
        "cash",
        "card",
        "bank_transfer",
        "online",
        "insurance",
      ],
      required: true,
    },

    transactionReference: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

PaymentSchema.index({
  invoice: 1,
  createdAt: -1,
});

PaymentSchema.index({
  patient: 1,
  createdAt: -1,
});

PaymentSchema.index({
  transactionReference: 1,
});

module.exports = mongoose.model("Payment", PaymentSchema);