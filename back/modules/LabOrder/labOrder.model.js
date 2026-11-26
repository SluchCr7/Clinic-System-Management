const mongoose = require("mongoose");

const ResultFileSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
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
      min: 0,
    },
    path: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const LabOrderItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["lab", "radiology", "LAB", "IMAGING"],
      default: "lab",
      required: true,
      set: (v) => {
        if (!v) return "lab";
        const lower = v.toLowerCase();
        if (lower === "imaging" || lower === "radiology") return "radiology";
        return "lab";
      },
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
      default: null,
    },

    instructions: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "ordered",
        "received",
        "cancelled",
        "REQUESTED",
        "RESULT_RECEIVED",
        "CANCELLED",
      ],
      default: "ordered",
      required: true,
      index: true,
      set: (v) => {
        if (!v) return "ordered";
        const map = {
          REQUESTED: "ordered",
          RESULT_RECEIVED: "received",
          CANCELLED: "cancelled",
          requested: "ordered",
          result_received: "received",
        };
        return map[v] || v.toLowerCase();
      },
    },

    labName: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    resultNotes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: null,
    },

    resultFiles: {
      type: [ResultFileSchema],
      default: [],
    },

    receivedAt: {
      type: Date,
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancelReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    statusHistory: [
      {
        from: {
          type: String,
          default: null,
        },
        to: {
          type: String,
          required: true,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          default: null,
        },
      },
    ],
  },
  {
    _id: true,
    timestamps: true,
  }
);

const LabOrderSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },

    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },

    visitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
      required: true,
      index: true,
    },

    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      default: null,
      index: true,
    },

    orderedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    priority: {
      type: String,
      enum: ["routine", "urgent", "stat"],
      default: "routine",
      required: true,
      index: true,
      set: (v) => {
        if (!v) return "routine";
        const val = v.toLowerCase();
        if (val === "stat" || val === "urgent") return "urgent";
        return "routine";
      },
    },

    items: {
      type: [LabOrderItemSchema],
      default: [],
    },

    // Backward compatibility references & fields
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },

    visit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visit",
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },

    type: {
      type: String,
      enum: ["LAB", "IMAGING", "lab", "radiology"],
      default: "LAB",
    },

    status: {
      type: String,
      enum: [
        "ordered",
        "received",
        "cancelled",
        "REQUESTED",
        "RESULT_RECEIVED",
        "CANCELLED",
      ],
      default: "REQUESTED",
    },

    tests: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
          maxlength: 200,
        },
        code: {
          type: String,
          trim: true,
          uppercase: true,
          maxlength: 50,
        },
        instructions: {
          type: String,
          trim: true,
          maxlength: 500,
        },
      },
    ],

    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    orderedAt: {
      type: Date,
      default: Date.now,
    },

    requestedAt: {
      type: Date,
      default: null,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    instructions: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    clinicalNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },

    expectedBy: {
      type: Date,
      default: null,
    },

    receivedAt: {
      type: Date,
      default: null,
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    performedAt: {
      type: Date,
      default: null,
    },

    externalFacilityName: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    resultNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },

    statusChangeReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    resultAttachment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalAttachment",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

// Middleware to keep modern and legacy fields synchronized
LabOrderSchema.pre("validate", function () {
  if (!this.patientId && this.patient) {
    this.patientId = this.patient;
  }
  if (!this.patient && this.patientId) {
    this.patient = this.patientId;
  }

  if (!this.visitId && this.visit) {
    this.visitId = this.visit;
  }
  if (!this.visit && this.visitId) {
    this.visit = this.visitId;
  }

  if (!this.orderedBy && this.createdBy) {
    this.orderedBy = this.createdBy;
  }
  if (!this.createdBy && this.orderedBy) {
    this.createdBy = this.orderedBy;
  }

  // Populate items from tests if items is empty
  if ((!this.items || this.items.length === 0) && this.tests && this.tests.length > 0) {
    const itemType =
      this.type === "IMAGING" || this.type === "radiology"
        ? "radiology"
        : "lab";
    const mappedStatus =
      this.status === "RESULT_RECEIVED"
        ? "received"
        : this.status === "CANCELLED"
        ? "cancelled"
        : "ordered";

    this.items = this.tests.map((t) => ({
      name: t.name,
      code: t.code,
      instructions: t.instructions,
      type: itemType,
      status: mappedStatus,
      labName: this.externalFacilityName,
      resultNotes: this.resultNotes,
      receivedAt: this.receivedAt,
    }));
  }

  // Populate tests from items if tests is empty
  if ((!this.tests || this.tests.length === 0) && this.items && this.items.length > 0) {
    this.tests = this.items.map((i) => ({
      name: i.name,
      code: i.code,
      instructions: i.instructions,
    }));
  }

  // Sync overall status
  if (this.items && this.items.length > 0) {
    const allReceived = this.items.every((i) => i.status === "received");
    const allCancelled = this.items.every((i) => i.status === "cancelled");
    const anyReceived = this.items.some((i) => i.status === "received");

    if (allReceived) {
      this.status = "RESULT_RECEIVED";
    } else if (allCancelled) {
      this.status = "CANCELLED";
    } else {
      this.status = "REQUESTED";
    }
  }
});

// Indexes for high performance and multi-tenant security
LabOrderSchema.index({ clinicId: 1, "items.status": 1, patientId: 1 });
LabOrderSchema.index({ clinicId: 1, status: 1, patientId: 1 });
LabOrderSchema.index({ clinicId: 1, visitId: 1 });
LabOrderSchema.index({ clinicId: 1, createdAt: -1 });
LabOrderSchema.index({ "items._id": 1 });
LabOrderSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model("LabOrder", LabOrderSchema);
