const mongoose = require("mongoose");

const InvoiceItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["consultation", "performed_service"],
      default: "performed_service",
    },

    performedService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PerformedService",
      required: function () {
        return this.type === "performed_service";
      },
    },

    serviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    serviceCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    discount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: true,
  }
);

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    visit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      required: true,
      unique: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    items: {
      type: [InvoiceItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return items.length > 0;
        },
        message: "Invoice must contain at least one item",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    tax: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    paidAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "unpaid",
        "partially_paid",
        "paid",
        "cancelled",
      ],
      default: "unpaid",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
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

InvoiceSchema.index({
  patient: 1,
  createdAt: -1,
});

InvoiceSchema.index({
  doctor: 1,
  createdAt: -1,
});

InvoiceSchema.index({
  status: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Invoice", InvoiceSchema);