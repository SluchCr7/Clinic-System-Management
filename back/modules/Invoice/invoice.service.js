const mongoose = require("mongoose");

const Invoice = require("./invoice.model");
const Visit = require("../Visit/visit.model");
const Appointment = require("../Appointment/appointment.model");
const PerformedService = require("../performedService/performedService.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");

const { AppError } = require("../../middlewares/errorHandler");

const generateInvoiceNumber = require("../../utils/generateInvoiceNumber");

const auditLogService = require("../AuditLog/auditLog.service");
const {
  getPagination,
  getPaginationMeta,
  paginateQuery,
} = require("../../utils/pagination");
const {
  getSearchRegex,
  getSort,
  applyCairoDateRange,
  applyDoctorScope,
  getDoctorScopeId,
} = require("../../utils/listQuery");

// ---------------------------------------------
// Helpers
// ---------------------------------------------

const roundMoney = (value) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

const isConsultationService = (service) => {
  const normalize = (value) =>
    String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  const name = normalize(service.serviceName);
  const code = normalize(service.serviceCode);

  return (
    ["consultation", "consultationfee", "clinicalconsultation"].includes(name) ||
    ["consult", "consultation", "consultationfee"].includes(code)
  );
};

// ---------------------------------------------
// Validation helpers
// ---------------------------------------------

const validateVisit = async (visitId) => {
  const visit = await Visit.findById(visitId);

  if (!visit) {
    throw new AppError(
      "Visit not found",
      404,
      "VISIT_NOT_FOUND"
    );
  }

  return visit;
};

const validatePatient = async (patientId) => {
  const patient = await Patient.findById(patientId);

  if (!patient) {
    throw new AppError(
      "Patient not found",
      404,
      "PATIENT_NOT_FOUND"
    );
  }

  if (!patient.isActive) {
    throw new AppError(
      "Patient is inactive",
      400,
      "PATIENT_INACTIVE"
    );
  }

  return patient;
};

const validateDoctor = async (doctorId) => {
  const doctor = await Doctor.findById(doctorId);

  if (!doctor) {
    throw new AppError(
      "Doctor not found",
      404,
      "DOCTOR_NOT_FOUND"
    );
  }

  if (!doctor.isActive) {
    throw new AppError(
      "Doctor is inactive",
      400,
      "DOCTOR_INACTIVE"
    );
  }

  return doctor;
};

// ---------------------------------------------
// Create Invoice
// ---------------------------------------------

const createInvoiceAttempt = async (data, currentUser) => {
  const {
    visit: visitId,
    discount = 0,
    tax = 0,
    notes,
  } = data;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // -----------------------------------------
    // 1. Validate Visit
    // -----------------------------------------

    const visit = await Visit.findById(visitId).session(
      session
    );

    if (!visit) {
      throw new AppError(
        "Visit not found",
        404,
        "VISIT_NOT_FOUND"
      );
    }

    // -----------------------------------------
    // 2. Validate Patient & Doctor
    // -----------------------------------------

    const [, doctor] = await Promise.all([
      validatePatient(visit.patient),
      validateDoctor(visit.doctor),
    ]);

    if (
      !Number.isFinite(doctor.consultationFee) ||
      doctor.consultationFee < 0
    ) {
      throw new AppError(
        "The doctor's consultation fee is unavailable. Update the doctor fee before creating this invoice.",
        400,
        "CONSULTATION_FEE_UNAVAILABLE"
      );
    }

    const appointment = await Appointment.findById(
      visit.appointment
    ).session(session);

    if (
      !appointment ||
      appointment.patient.toString() !== visit.patient.toString() ||
      appointment.doctor.toString() !== visit.doctor.toString()
    ) {
      throw new AppError(
        "The visit is not linked to a valid appointment",
        400,
        "INVALID_VISIT_APPOINTMENT"
      );
    }

    if (appointment.status !== "completed") {
      throw new AppError(
        "Only completed visits can be invoiced",
        400,
        "VISIT_NOT_BILLABLE"
      );
    }

    // -----------------------------------------
    // 3. One Visit = One Invoice
    // -----------------------------------------

    const existingInvoice = await Invoice.findOne({
      visit: visit._id,
    }).session(session);

    if (existingInvoice) {
      throw new AppError(
        "An invoice already exists for this visit",
        409,
        "INVOICE_ALREADY_EXISTS"
      );
    }

    // -----------------------------------------
    // 4. Get Performed Services
    // -----------------------------------------

    const performedServices =
      await PerformedService.find({
        visit: visit._id,
      })
        .sort({ createdAt: 1 })
        .session(session);

    const consultationFee = roundMoney(doctor.consultationFee);

    // -----------------------------------------
    // 5. Build Invoice Items
    // -----------------------------------------

    const items = [
      {
        type: "consultation",
        serviceName: "Consultation fee",
        serviceCode: "CONSULTATION",
        unitPrice: consultationFee,
        quantity: 1,
        discount: 0,
        total: consultationFee,
      },
      ...performedServices
        .filter((performedService) => !isConsultationService(performedService))
        .map((performedService) => {
          if (
            performedService.patient?.toString() !== visit.patient.toString() ||
            performedService.doctor?.toString() !== visit.doctor.toString() ||
            !Number.isFinite(performedService.price) ||
            performedService.price < 0 ||
            !Number.isSafeInteger(performedService.quantity) ||
            performedService.quantity < 1 ||
            !Number.isFinite(performedService.discount) ||
            performedService.discount < 0
          ) {
            throw new AppError(
              "A performed service is invalid or does not belong to this visit",
              400,
              "INVALID_PERFORMED_SERVICE"
            );
          }

          const itemSubtotal =
            performedService.price *
            performedService.quantity;

          if (
            !Number.isFinite(itemSubtotal) ||
            performedService.discount > itemSubtotal
          ) {
            throw new AppError(
              "A performed service has an invalid price or discount",
              400,
              "INVALID_PERFORMED_SERVICE"
            );
          }

          const itemTotal =
            itemSubtotal -
            performedService.discount;

          return {
            type: "performed_service",
            performedService:
              performedService._id,

            serviceName:
              performedService.serviceName,

            serviceCode:
              performedService.serviceCode,

            unitPrice:
              performedService.price,

            quantity:
              performedService.quantity,

            discount:
              performedService.discount,

            total:
              roundMoney(itemTotal),
          };
        }),
    ];

    // -----------------------------------------
    // 6. Calculate Subtotal
    // -----------------------------------------

    const subtotal = roundMoney(
      items.reduce((sum, item) => {
        return sum + item.total;
      }, 0)
    );

    // -----------------------------------------
    // 7. Validate Discount
    // -----------------------------------------

    if (discount > subtotal) {
      throw new AppError(
        "Invoice discount cannot exceed subtotal",
        400,
        "INVALID_INVOICE_DISCOUNT"
      );
    }

    // -----------------------------------------
    // 8. Calculate Total
    // -----------------------------------------

    const total = roundMoney(
      subtotal - discount + tax
    );

    // -----------------------------------------
    // 9. Generate Invoice Number
    // -----------------------------------------

    const invoiceNumber =
      await generateInvoiceNumber(session);

    // -----------------------------------------
    // 10. Create Invoice
    // -----------------------------------------

    const [invoice] = await Invoice.create(
      [
        {
          invoiceNumber,
          visit: visit._id,
          patient: visit.patient,
          doctor: visit.doctor,
          items,
          subtotal,
          discount,
          tax,
          total,
          paidAmount: 0,
          remainingAmount: total,
          status:
            total === 0
              ? "paid"
              : "unpaid",
          notes,
          createdBy: currentUser._id,
        },
      ],
      { session }
    );

    // -----------------------------------------
    // 11. Audit Log
    // -----------------------------------------

    await auditLogService.logActivity({
      actor: currentUser,
      action: "INVOICE_CREATED",
      resource: "Invoice",
      resourceId: invoice._id,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        visit: invoice.visit,
        patient: invoice.patient,
        doctor: invoice.doctor,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        tax: invoice.tax,
        total: invoice.total,
        paidAmount: invoice.paidAmount,
        remainingAmount: invoice.remainingAmount,
        status: invoice.status,
      },
      session,
    });

    // -----------------------------------------
    // 12. Commit
    // -----------------------------------------

    await session.commitTransaction();

    return invoice;
  } catch (error) {
    // -----------------------------------------
    // Rollback
    // -----------------------------------------

    await session.abortTransaction();
    if (error.code === 11000) {
      if (error.keyPattern?.visit || (error.keyValue && error.keyValue.visit)) {
        throw new AppError(
          "An invoice already exists for this visit",
          409,
          "INVOICE_ALREADY_EXISTS"
        );
      }
      if (error.keyPattern?.invoiceNumber || (error.keyValue && error.keyValue.invoiceNumber)) {
        throw new AppError(
          "Invoice number already exists",
          409,
          "DUPLICATE_INVOICE_NUMBER"
        );
      }
    }
    throw error;
  } finally {
    session.endSession();
  }
};

const createInvoice = async (data, currentUser) => {
  let attempt = 0;
  const maxAttempts = 3;

  while (true) {
    try {
      return await createInvoiceAttempt(data, currentUser);
    } catch (error) {
      const isTransientTransactionConflict =
        error.code === 112 ||
        error.hasErrorLabel?.("TransientTransactionError");

      if (!isTransientTransactionConflict) {
        throw error;
      }

      const existingInvoice = await Invoice.findOne({
        visit: data.visit,
      })
        .select("_id")
        .lean();

      if (existingInvoice) {
        throw new AppError(
          "An invoice already exists for this visit",
          409,
          "INVOICE_ALREADY_EXISTS"
        );
      }

      if (attempt >= maxAttempts - 1) {
        throw error;
      }

      attempt += 1;
      await new Promise((resolve) =>
        setTimeout(resolve, 10 * attempt)
      );
    }
  }
};

const getEligibleVisits = async (query = {}) => {
  const pagination = getPagination(query.page, query.limit);
  const pipeline = [
    {
      $lookup: {
        from: Appointment.collection.name,
        localField: "appointment",
        foreignField: "_id",
        as: "appointmentRecord",
      },
    },
    { $match: { "appointmentRecord.status": "completed" } },
    {
      $lookup: {
        from: Invoice.collection.name,
        localField: "_id",
        foreignField: "visit",
        as: "existingInvoices",
      },
    },
    { $match: { "existingInvoices.0": { $exists: false } } },
    {
      $lookup: {
        from: Patient.collection.name,
        localField: "patient",
        foreignField: "_id",
        as: "patientRecord",
      },
    },
    { $match: { "patientRecord.isActive": true } },
    {
      $lookup: {
        from: Doctor.collection.name,
        localField: "doctor",
        foreignField: "_id",
        as: "doctorRecord",
      },
    },
    { $match: { "doctorRecord.isActive": true } },
    {
      $facet: {
        data: [
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: pagination.skip },
          { $limit: pagination.limit },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await Visit.aggregate(pipeline);
  const records = result?.data || [];
  const visits = await Visit.populate(records, [
    {
      path: "patient",
      select: "firstName lastName phone email",
    },
    {
      path: "doctor",
      select: "user specialization licenseNumber consultationFee",
      populate: {
        path: "user",
        select: "firstName lastName",
      },
    },
    {
      path: "appointment",
      select: "appointmentDate duration status",
    },
  ]);
  const total = result?.total?.[0]?.count || 0;

  return {
    data: visits,
    pagination: getPaginationMeta(
      pagination.page,
      pagination.limit,
      total
    ),
  };
};

// ---------------------------------------------
// Get All Invoices
// ---------------------------------------------

const getInvoices = async (query = {}, currentUser = null) => {
  const filter = {};

  if (query.patient) {
    filter.patient = query.patient;
  }

  if (query.doctor) {
    filter.doctor = query.doctor;
  }

  if (query.visit) {
    filter.visit = query.visit;
  }

  if (query.status) {
    filter.status = query.status;
  }

  const searchRegex = getSearchRegex(query.search);
  if (searchRegex) {
    filter.invoiceNumber = searchRegex;
  }

  applyCairoDateRange(filter, "issuedAt", query);
  await applyDoctorScope(filter, query, currentUser, Doctor);

  return paginateQuery(
    Invoice.find(filter)
      .populate(
        "patient",
        "firstName lastName phone email"
      )
      .populate({
        path: "doctor",
        select: "user specialization licenseNumber",
        populate: {
          path: "user",
          select: "firstName lastName email",
        },
      })
      .populate(
        "visit",
        "chiefComplaint diagnosis createdAt"
      )
      .sort(
        getSort(
          query,
          [
            "invoiceNumber",
            "issuedAt",
            "total",
            "status",
            "createdAt",
            "updatedAt",
          ],
          "createdAt"
        )
      ),
    Invoice.countDocuments(filter),
    query.page,
    query.limit
  );
};

// ---------------------------------------------
// Get Invoice By ID
// ---------------------------------------------

const getInvoiceById = async (id, currentUser = null) => {
  const filter = { _id: id };
  if (currentUser?.role === "doctor") {
    const doctorId = await getDoctorScopeId(currentUser, Doctor);
    if (!doctorId) return null;
    filter.doctor = doctorId;
  }

  return await Invoice.findOne(filter)
    .populate(
      "patient",
      "firstName lastName phone email dateOfBirth gender"
    )
    .populate({
      path: "doctor",
      select: "user specialization licenseNumber",
      populate: {
        path: "user",
        select: "firstName lastName email phone",
      },
    })
    .populate(
      "visit",
      "chiefComplaint symptoms diagnosis doctorNotes followUpDate createdAt"
    )
    .populate(
      "items.performedService",
      "serviceName serviceCode price quantity discount performedAt"
    );
};

// ---------------------------------------------
// Update Invoice
// ---------------------------------------------

const updateInvoice = async (id, data, currentUser) => {
  const invoice = await Invoice.findById(id);

  if (!invoice) {
    return null;
  }

  // -------------------------------------------
  // Cannot modify cancelled invoice
  // -------------------------------------------

  if (invoice.status === "cancelled") {
    throw new AppError(
      "Cancelled invoice cannot be updated",
      400,
      "INVOICE_CANCELLED"
    );
  }

  // -------------------------------------------
  // Financial records already paid
  // cannot have their core amounts changed
  // -------------------------------------------

  if (
    invoice.paidAmount > 0 &&
    (data.discount !== undefined ||
      data.tax !== undefined)
  ) {
    throw new AppError(
      "Discount or tax cannot be changed after payment",
      400,
      "INVOICE_ALREADY_PAID"
    );
  }

  const discount =
    data.discount !== undefined
      ? data.discount
      : invoice.discount;

  const tax =
    data.tax !== undefined
      ? data.tax
      : invoice.tax;

  if (discount > invoice.subtotal) {
    throw new AppError(
      "Invoice discount cannot exceed subtotal",
      400,
      "INVALID_INVOICE_DISCOUNT"
    );
  }

  const total = roundMoney(
    invoice.subtotal - discount + tax
  );

  const remainingAmount = roundMoney(
    total - invoice.paidAmount
  );

  if (remainingAmount < 0) {
    throw new AppError(
      "Invoice total cannot be less than the paid amount",
      400,
      "INVALID_INVOICE_TOTAL"
    );
  }

  // -------------------------------------------
  // Save previous values for audit
  // -------------------------------------------

  const previousValues = {
    discount: invoice.discount,
    tax: invoice.tax,
    total: invoice.total,
    remainingAmount: invoice.remainingAmount,
    status: invoice.status,
    notes: invoice.notes,
  };

  invoice.discount = discount;
  invoice.tax = tax;
  invoice.total = total;
  invoice.remainingAmount = remainingAmount;

  if (remainingAmount === 0) {
    invoice.status = "paid";
  } else if (invoice.paidAmount > 0) {
    invoice.status = "partially_paid";
  } else {
    invoice.status = "unpaid";
  }

  if (data.notes !== undefined) {
    invoice.notes = data.notes;
  }

  invoice.updatedBy = currentUser._id;

  await invoice.save();

  // -------------------------------------------
  // Audit Log
  // -------------------------------------------

  await auditLogService.logActivity({
    actor: currentUser,
    action: "INVOICE_UPDATED",
    resource: "Invoice",
    resourceId: invoice._id,
    details: {
      invoiceNumber: invoice.invoiceNumber,

      previousValues,

      newValues: {
        discount: invoice.discount,
        tax: invoice.tax,
        total: invoice.total,
        remainingAmount: invoice.remainingAmount,
        status: invoice.status,
        notes: invoice.notes,
      },
    },
  });

  return invoice;
};

// ---------------------------------------------
// Cancel Invoice
// ---------------------------------------------

const cancelInvoice = async (id, currentUser) => {
  const invoice = await Invoice.findById(id);

  if (!invoice) {
    return null;
  }

  if (invoice.status === "cancelled") {
    throw new AppError(
      "Invoice is already cancelled",
      400,
      "INVOICE_ALREADY_CANCELLED"
    );
  }

  if (invoice.paidAmount > 0) {
    throw new AppError(
      "Paid invoices cannot be cancelled directly",
      400,
      "INVOICE_HAS_PAYMENTS"
    );
  }

  invoice.status = "cancelled";
  invoice.updatedBy = currentUser._id;

  await invoice.save();

  // -------------------------------------------
  // Audit Log
  // -------------------------------------------

  await auditLogService.logActivity({
    actor: currentUser,
    action: "INVOICE_CANCELLED",
    resource: "Invoice",
    resourceId: invoice._id,
    details: {
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      paidAmount: invoice.paidAmount,
      remainingAmount: invoice.remainingAmount,
      previousStatus: "unpaid",
      newStatus: "cancelled",
    },
  });

  return invoice;
};

module.exports = {
  createInvoice,
  getEligibleVisits,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  cancelInvoice,
};