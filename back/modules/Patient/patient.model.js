const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema(
  {
    // Basic Information
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    dateOfBirth: {
      type: Date,
      required: true,
    },

    gender: {
      type: String,
      enum: ["male", "female"],
      required: true,
    },

    // Contact Information
    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    address: {
      street: String,
      city: String,
      country: String,
    },

    // Emergency Contact
    emergencyContact: {
      name: {
        type: String,
        trim: true,
      },

      phone: {
        type: String,
        trim: true,
      },

      relationship: {
        type: String,
        trim: true,
      },
    },

    // Medical Information
    bloodType: {
      type: String,
      enum: [
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
      ],
    },

    allergies: [
      {
        type: String,
        trim: true,
      },
    ],

    chronicDiseases: [
      {
        type: String,
        trim: true,
      },
    ],

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Who created the patient
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }
  },
  {
    timestamps: true,
  }
);

PatientSchema.index({
  isActive: 1,
  createdAt: -1,
});

PatientSchema.index({ phone: 1 }, { unique: true });
PatientSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: "string", $gt: "" },
    },
  }
);

module.exports = mongoose.model("Patient", PatientSchema);
