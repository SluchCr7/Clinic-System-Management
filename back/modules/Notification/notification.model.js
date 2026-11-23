const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "appointment",
        "lab_order",
        "payment",
        "prescription",
        "medical_attachment",
        "visit_completed",
        "lab_result",
        "lab_cancelled",
        "system",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    relatedModel: {
      type: String,
      enum: [
        "Appointment",
        "LabOrder",
        "Payment",
        "Prescription",
        "MedicalAttachment",
        "Visit",
        null,
      ],
      default: null,
    },

    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    eventKey: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    entityType: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    link: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({
  recipient: 1,
  isRead: 1,
  createdAt: -1,
});

NotificationSchema.index({
  recipient: 1,
  createdAt: -1,
});

NotificationSchema.index(
  { eventKey: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model(
  "Notification",
  NotificationSchema
);