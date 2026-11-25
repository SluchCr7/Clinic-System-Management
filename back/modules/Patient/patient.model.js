const mongoose = require("mongoose");

const PatientSchema = new mongoose.Schema(
  {
    // Clinic / Doctor workspace ownership
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },

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

    // Who created the patient (Receptionist)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

PatientSchema.index({
  doctor: 1,
  isActive: 1,
  createdAt: -1,
});

PatientSchema.index({
  doctor: 1,
  firstName: 1,
  lastName: 1,
});

PatientSchema.index({
  isActive: 1,
  createdAt: -1,
});

PatientSchema.index({ doctor: 1, phone: 1 }, { unique: true });
PatientSchema.index(
  { doctor: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: "string", $gt: "" },
    },
  }
);

module.exports = mongoose.model("Patient", PatientSchema);
