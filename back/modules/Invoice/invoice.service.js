const mongoose = require("mongoose");

const Invoice = require("./invoice.model");
const Visit = require("../Visit/visit.model");
const PerformedService = require("../performedService/performedService.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");

const { AppError } = require("../../middlewares/errorHandler");

const generateInvoiceNumber = require("../../utils/generateInvoiceNumber");

const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const {
  getSearchRegex,
  getSort,
  applyCairoDateRange,
  applyDoctorScope,
} = require("../../utils/listQuery");

// ---------------------------------------------
// Helpers
// ---------------------------------------------

const roundMoney = (value) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

const createInvoice = async (data, currentUser) => {
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

    await Promise.all([
      validatePatient(visit.patient),
      validateDoctor(visit.doctor),
    ]);

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

    if (performedServices.length === 0) {
      throw new AppError(
        "Cannot create invoice without performed services",
        400,
        "NO_PERFORMED_SERVICES"
      );
    }

    // -----------------------------------------
    // 5. Build Invoice Items
    // -----------------------------------------

    const items = performedServices.map(
      (performedService) => {
        const itemSubtotal =
          performedService.price *
          performedService.quantity;

        const itemTotal =
          itemSubtotal -
          performedService.discount;

        return {
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
      }
    );

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
    throw error;
  } finally {
    session.endSession();
  }
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

const getInvoiceById = async (id) => {
  return await Invoice.findById(id)
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
  getInvoices,
  getInvoiceById,
  updateInvoice,
  cancelInvoice,
};