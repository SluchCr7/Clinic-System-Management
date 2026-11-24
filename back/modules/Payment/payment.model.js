const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: [true, "الفاتورة مطلوبة"],
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: [true, "المريض مطلوب"],
    },

    amount: {
      type: Number,
      required: [true, "مبلغ الدفع مطلوب"],
      validate: {
        validator: function (v) {
          if (this.isReversal) return typeof v === "number" && v < 0;
          return typeof v === "number" && v > 0;
        },
        message: "يجب أن يكون مبلغ الدفع أكبر من 0 (أو سالباً للعمليات العكسية)",
      },
    },

    paymentMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentMethod",
      default: null,
    },

    // Method code stored for backwards-compatibility and easy reporting
    method: {
      type: String,
      trim: true,
      lowercase: true,
      default: "cash",
    },

    referenceNumber: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },

    // Kept for backward compatibility with existing code
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
      default: null,
    },

    paidAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "الموظف المستلم مطلوب"],
    },

    // Kept for backward compatibility
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    idempotencyKey: {
      type: String,
      trim: true,
    },

    // Payment reversal tracking (never delete or edit a payment)
    isReversal: {
      type: Boolean,
      default: false,
    },

    reversedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    reversalReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PaymentSchema.index({
  invoice: 1,
  createdAt: -1,
});

PaymentSchema.index({
  patient: 1,
  createdAt: -1,
});

// Idempotency key must be unique when present
PaymentSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

PaymentSchema.index({
  paidAt: -1,
});

PaymentSchema.index({
  receivedBy: 1,
  paidAt: -1,
});

PaymentSchema.index({
  paymentMethod: 1,
  paidAt: -1,
});

PaymentSchema.index({
  transactionReference: 1,
});

PaymentSchema.index({
  referenceNumber: 1,
});

module.exports = mongoose.model("Payment", PaymentSchema);
