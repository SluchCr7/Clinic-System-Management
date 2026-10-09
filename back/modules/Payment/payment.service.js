const mongoose = require("mongoose");

const Payment = require("./payment.model");
const Invoice = require("../Invoice/invoice.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");

const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const {
  getSort,
  applyCairoDateRange,
} = require("../../utils/listQuery");

// ---------------------------------------------
// Helpers
// ---------------------------------------------

const roundMoney = (value) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

// ---------------------------------------------
// Validate Invoice
// ---------------------------------------------

const validateInvoice = async (invoiceId, session) => {
  const invoice = await Invoice.findById(invoiceId).session(
    session
  );

  if (!invoice) {
    throw new AppError(
      "Invoice not found",
      404,
      "INVOICE_NOT_FOUND"
    );
  }

  if (invoice.status === "cancelled") {
    throw new AppError(
      "Cannot make payment for a cancelled invoice",
      400,
      "INVOICE_CANCELLED"
    );
  }

  if (invoice.remainingAmount <= 0) {
    throw new AppError(
      "Invoice is already fully paid",
      400,
      "INVOICE_ALREADY_PAID"
    );
  }

  return invoice;
};

// ---------------------------------------------
// Validate Patient
// ---------------------------------------------

const validatePatient = async (patientId, session) => {
  const patient = await Patient.findById(patientId).session(
    session
  );

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

// ---------------------------------------------
// Create Payment
// ---------------------------------------------

const createPayment = async (data, currentUser) => {
  const {
    invoice: invoiceId,
    amount,
    method,
    transactionReference,
    notes,
    paidAt,
  } = data;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // -----------------------------------------
    // 1. Validate invoice
    // -----------------------------------------

    const invoice = await validateInvoice(
      invoiceId,
      session
    );

    // -----------------------------------------
    // 2. Validate patient
    // -----------------------------------------

    const patient = await validatePatient(
      invoice.patient,
      session
    );

    // -----------------------------------------
    // 3. Validate amount
    // -----------------------------------------

    if (amount > invoice.remainingAmount) {
      throw new AppError(
        `Payment amount cannot exceed remaining amount (${invoice.remainingAmount})`,
        400,
        "PAYMENT_EXCEEDS_REMAINING"
      );
    }

    // -----------------------------------------
    // 4. Validate payment date
    // -----------------------------------------

    if (paidAt && new Date(paidAt) > new Date()) {
      throw new AppError(
        "Payment date cannot be in the future",
        400,
        "INVALID_PAYMENT_DATE"
      );
    }

    // -----------------------------------------
    // 5. Validate transaction reference
    // -----------------------------------------

    const electronicMethods = [
      "card",
      "bank_transfer",
      "online",
    ];

    if (
      electronicMethods.includes(method) &&
      !transactionReference
    ) {
      throw new AppError(
        "Transaction reference is required for electronic payments",
        400,
        "TRANSACTION_REFERENCE_REQUIRED"
      );
    }

    // -----------------------------------------
    // 6. Atomic invoice update
    // -----------------------------------------

    const updatedInvoice =
      await Invoice.findOneAndUpdate(
        {
          _id: invoice._id,

          status: {
            $ne: "cancelled",
          },

          remainingAmount: {
            $gte: amount,
          },
        },
        {
          $inc: {
            paidAmount: amount,
            remainingAmount: -amount,
          },
        },
        {
          new: true,
          session,
        }
      );

    // -----------------------------------------
    // 7. Race condition protection
    // -----------------------------------------

    if (!updatedInvoice) {
      throw new AppError(
        "Payment could not be processed because the invoice balance has changed",
        409,
        "PAYMENT_CONFLICT"
      );
    }

    // -----------------------------------------
    // 8. Calculate new status
    // -----------------------------------------

    const paidAmount = roundMoney(
      updatedInvoice.paidAmount
    );

    const remainingAmount = roundMoney(
      updatedInvoice.remainingAmount
    );

    let status = "unpaid";

    if (remainingAmount === 0) {
      status = "paid";
    } else if (paidAmount > 0) {
      status = "partially_paid";
    }

    // -----------------------------------------
    // 9. Update invoice status
    // -----------------------------------------

    updatedInvoice.paidAmount = paidAmount;
    updatedInvoice.remainingAmount = remainingAmount;
    updatedInvoice.status = status;
    updatedInvoice.updatedBy = currentUser._id;

    await updatedInvoice.save({
      session,
    });

    // -----------------------------------------
    // 10. Create payment
    // -----------------------------------------

    const [payment] = await Payment.create(
      [
        {
          invoice: updatedInvoice._id,

          patient: patient._id,

          amount: roundMoney(amount),

          method,

          transactionReference:
            transactionReference || null,

          notes,

          paidAt,

          createdBy: currentUser._id,
        },
      ],
      {
        session,
      }
    );
    // -----------------------------------------
    // 11. Create audit log
    // -----------------------------------------

    await auditLogService.logActivity({
      actor: currentUser,
      action: "PAYMENT_CREATED",
      resource: "Payment",
      resourceId: payment._id,
      details: {
        amount: payment.amount,
        method: payment.method,
        transactionReference:
          payment.transactionReference,
        invoice: updatedInvoice._id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        previousPaidAmount: roundMoney(
          invoice.paidAmount
        ),
        newPaidAmount: paidAmount,
        previousRemainingAmount: roundMoney(
          invoice.remainingAmount
        ),
        newRemainingAmount: remainingAmount,
        status,
      },
      session,
    });
    // -----------------------------------------
    // 11. Commit transaction
    // -----------------------------------------

    await session.commitTransaction();

    return payment;
  } catch (error) {
    // -----------------------------------------
    // Rollback everything
    // -----------------------------------------

    await session.abortTransaction();

    throw error;
  } finally {
    session.endSession();
  }
};

// ---------------------------------------------
// Get Payments
// ---------------------------------------------

const getPayments = async (query = {}, currentUser = null) => {
  const filter = {};

  if (query.invoice) {
    filter.invoice = query.invoice;
  }

  if (query.patient) {
    filter.patient = query.patient;
  }

  if (query.method) {
    filter.method = query.method;
  }

  applyCairoDateRange(filter, "paidAt", query);

  if (currentUser?.role === "doctor") {
    const doctor = await Doctor.findOne({
      user: currentUser._id,
    })
      .select("_id")
      .lean()
      .exec();
    const invoiceIds = doctor
      ? await Invoice.distinct("_id", { doctor: doctor._id })
      : [];

    filter.invoice =
      query.invoice && !invoiceIds.some(
        (invoiceId) => invoiceId.toString() === query.invoice
      )
        ? { $in: [] }
        : { $in: invoiceIds };
  }

  return paginateQuery(
    Payment.find(filter)
      .populate(
        "patient",
        "firstName lastName phone email"
      )
      .populate(
        "invoice",
        "invoiceNumber total paidAmount remainingAmount status issuedAt"
      )
      .populate(
        "createdBy",
        "firstName lastName email role"
      )
      .sort(
        getSort(
          query,
          ["paidAt", "amount", "method", "createdAt"],
          "paidAt"
        )
      ),
    Payment.countDocuments(filter),
    query.page,
    query.limit
  );
};

// ---------------------------------------------
// Get Payment By ID
// ---------------------------------------------

const getPaymentById = async (id) => {
  return await Payment.findById(id)
    .populate(
      "patient",
      "firstName lastName phone email"
    )
    .populate(
      "invoice",
      "invoiceNumber total paidAmount remainingAmount status issuedAt"
    )
    .populate(
      "createdBy",
      "firstName lastName email role"
    );
};

module.exports = {
  createPayment,
  getPayments,
  getPaymentById,
};