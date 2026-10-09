const mongoose = require("mongoose");

const MedicalAttachmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    visit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      default: null,
    },

    type: {
      type: String,
      enum: [
        "lab_report",
        "xray",
        "prescription",
        "medical_report",
        "other",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    file: {
      url: {
        type: String,
        required: true,
      },

      publicId: {
        type: String,
        required: true,
      },

      originalName: {
        type: String,
        required: true,
        trim: true,
      },

      mimeType: {
        type: String,
        required: true,
        trim: true,
      },

      size: {
        type: Number,
        required: true,
        min: 1,
      },
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Patient medical files
MedicalAttachmentSchema.index({
  patient: 1,
  createdAt: -1,
});

// Visit medical files
MedicalAttachmentSchema.index({
  visit: 1,
  createdAt: -1,
});

// Filter by attachment type
MedicalAttachmentSchema.index({
  patient: 1,
  type: 1,
});

module.exports = mongoose.model(
  "MedicalAttachment",
  MedicalAttachmentSchema
);