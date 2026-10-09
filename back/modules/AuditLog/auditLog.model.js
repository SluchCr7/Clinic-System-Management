const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 100,
    },

    resource: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },

    userAgent: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

AuditLogSchema.index({
  actor: 1,
  createdAt: -1,
});

AuditLogSchema.index({
  resource: 1,
  resourceId: 1,
  createdAt: -1,
});

AuditLogSchema.index({
  action: 1,
  createdAt: -1,
});

AuditLogSchema.index({
  createdAt: -1,
});

module.exports = mongoose.model("AuditLog", AuditLogSchema);
