const mongoose = require("mongoose");

const Payment = require("./payment.model");
const Invoice = require("../Invoice/invoice.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");
const PaymentMethod = require("../PaymentMethod/paymentMethod.model");
const paymentMethodService = require("../PaymentMethod/paymentMethod.service");

const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const {
  getSort,
  applyCairoDateRange,
  getDoctorScopeId,
} = require("../../utils/listQuery");
const {
  assertDoctorAccess,
  getAuthorizedDoctorIds,
} = require("../../utils/accessControl");

// ---------------------------------------------
// Safe Money Helpers (Smallest Unit: Piasters)
// ---------------------------------------------

const toPiasters = (value) => {
  return Math.round((Number(value) + Number.EPSILON) * 100);
};

const fromPiasters = (piasters) => {
  return Math.round(piasters) / 100;
};

const roundMoney = (value) => {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
};

// ---------------------------------------------
// Validate Invoice
// ---------------------------------------------

const validateInvoice = async (invoiceId, session) => {
  const invoice = await Invoice.findById(invoiceId).session(session);

  if (!invoice) {
    throw new AppError(
      "الفاتورة غير موجودة",
      404,
      "INVOICE_NOT_FOUND"
    );
  }

  if (invoice.status === "draft") {
    throw new AppError(
      "لا يمكن تسجيل دفعة لفاتورة مسودة. يرجى إصدار الفاتورة أولاً",
      400,
      "INVOICE_NOT_ISSUED"
    );
  }

  if (invoice.status === "cancelled") {
    throw new AppError(
      "لا يمكن تسجيل دفعة لفاتورة ملغاة",
      400,
      "INVOICE_CANCELLED"
    );
  }

  const remainingPiasters = toPiasters(invoice.remainingAmount);
  if (remainingPiasters <= 0 || invoice.status === "paid") {
    throw new AppError(
      "الفاتورة مدفوعة بالكامل بالفعل",
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
  const patient = await Patient.findById(patientId).session(session);

  if (!patient) {
    throw new AppError(
      "المريض غير موجود",
      404,
      "PATIENT_NOT_FOUND"
    );
  }

  if (!patient.isActive) {
    throw new AppError(
      "المريض غير نشط",
      400,
      "PATIENT_INACTIVE"
    );
  }

  return patient;
};

// ---------------------------------------------
// Resolve and Validate Payment Method
// ---------------------------------------------

const resolvePaymentMethod = async (paymentMethodInput, methodInput, session) => {
  let target = paymentMethodInput || methodInput;

  let selectedMethod = null;

  if (target) {
    if (mongoose.Types.ObjectId.isValid(target)) {
      selectedMethod = await PaymentMethod.findById(target).session(session);
    }
    if (!selectedMethod) {
      selectedMethod = await PaymentMethod.findOne({
        code: String(target).toLowerCase().trim(),
      }).session(session);
    }

    if (!selectedMethod && String(target).toLowerCase().trim() === "cash") {
      selectedMethod = await paymentMethodService.getDefaultPaymentMethod(session);
    }

    if (!selectedMethod) {
      throw new AppError(
        "طريقة الدفع المحددة غير موجودة",
        400,
        "INVALID_PAYMENT_METHOD"
      );
    }
  } else {
    // Default to the default payment method (cash)
    selectedMethod = await paymentMethodService.getDefaultPaymentMethod(session);
  }

  if (!selectedMethod) {
    throw new AppError(
      "لم يتم العثور على طريقة دفع افتراضية مفعّلة في النظام",
      500,
      "DEFAULT_PAYMENT_METHOD_MISSING"
    );
  }

  if (!selectedMethod.isActive) {
    throw new AppError(
      "طريقة الدفع المحددة غير مفعلة حالياً",
      400,
      "PAYMENT_METHOD_INACTIVE"
    );
  }

  return selectedMethod;
};

// ---------------------------------------------
// Create Payment (Transactional, Safe Money, Idempotent)
// ---------------------------------------------

const createPayment = async (data, currentUser) => {
  const {
    invoice: invoiceId,
    amount,
    paymentMethod: paymentMethodInput,
    method: methodInput,
    referenceNumber,
    transactionReference,
    notes,
    paidAt,
    idempotencyKey,
  } = data;

  const normalizedIdempotencyKey = idempotencyKey?.trim() || null;

  // -----------------------------------------
  // 1. Check idempotency key before starting
  // -----------------------------------------
  if (normalizedIdempotencyKey) {
    const existing = await Payment.findOne({
      idempotencyKey: normalizedIdempotencyKey,
    })
      .populate("paymentMethod")
      .populate("invoice", "invoiceNumber total paidAmount remainingAmount status issuedAt")
      .populate("patient", "firstName lastName phone email")
      .populate("receivedBy", "firstName lastName email role")
      .populate("createdBy", "firstName lastName email role");

    if (existing) {
      return existing;
    }
  }

  const session = await mongoose.startSession();
  let createdPaymentDoc = null;

  try {
    await session.withTransaction(async () => {
      // -----------------------------------------
      // 2. Validate Invoice
      // -----------------------------------------
      const invoice = await validateInvoice(invoiceId, session);

      if (currentUser) {
        await assertDoctorAccess(currentUser, invoice.doctor);
      }

      // -----------------------------------------
      // 3. Validate Patient
      // -----------------------------------------
      const patient = await validatePatient(invoice.patient, session);

      // -----------------------------------------
      // 4. Safe Money Calculation (in piasters)
      // -----------------------------------------
      const paymentPiasters = toPiasters(amount);
      const remainingPiasters = toPiasters(invoice.remainingAmount);

      if (paymentPiasters <= 0) {
        throw new AppError(
          "يجب أن يكون مبلغ الدفع أكبر من صفر",
          400,
          "INVALID_PAYMENT_AMOUNT"
        );
      }

      if (paymentPiasters > remainingPiasters) {
        throw new AppError(
          `مبلغ الدفع (${amount}) لا يمكن أن يتجاوز الرصيد المتبقي (${invoice.remainingAmount})`,
          400,
          "PAYMENT_EXCEEDS_REMAINING"
        );
      }

      // -----------------------------------------
      // 5. Payment Date Validation
      // -----------------------------------------
      if (paidAt && new Date(paidAt) > new Date()) {
        throw new AppError(
          "تاريخ الدفع لا يمكن أن يكون في المستقبل",
          400,
          "INVALID_PAYMENT_DATE"
        );
      }

      // -----------------------------------------
      // 6. Resolve Payment Method & Reference
      // -----------------------------------------
      const selectedMethod = await resolvePaymentMethod(
        paymentMethodInput,
        methodInput,
        session
      );

      const refNumber = (referenceNumber || transactionReference || "").trim();

      if (selectedMethod.requiresReference && !refNumber) {
        throw new AppError(
          `رقم العملية / المرجع مطلوب لطريقة الدفع: ${selectedMethod.nameAr}`,
          400,
          "TRANSACTION_REFERENCE_REQUIRED"
        );
      }

      // -----------------------------------------
      // 7. Atomic Invoice Update
      // -----------------------------------------
      const paymentAmountFloat = fromPiasters(paymentPiasters);

      const updatedInvoice = await Invoice.findOneAndUpdate(
        {
          _id: invoice._id,
          status: { $nin: ["cancelled", "draft"] },
          remainingAmount: { $gte: paymentAmountFloat },
        },
        {
          $inc: {
            paidAmount: paymentAmountFloat,
            remainingAmount: -paymentAmountFloat,
          },
        },
        {
          returnDocument: "after",
          session,
        }
      );

      if (!updatedInvoice) {
        throw new AppError(
          "تعذر إتمام الدفع بسبب تعديل رصيد الفاتورة في نفس الوقت. يرجى إعادة المحاولة",
          409,
          "PAYMENT_CONFLICT"
        );
      }

      // -----------------------------------------
      // 8. Calculate New Status Safely
      // -----------------------------------------
      const newPaidPiasters = toPiasters(updatedInvoice.paidAmount);
      const newRemainingPiasters = toPiasters(updatedInvoice.remainingAmount);

      const paidAmount = fromPiasters(newPaidPiasters);
      const remainingAmount = fromPiasters(newRemainingPiasters);

      let newStatus = updatedInvoice.status === "draft" ? "draft" : "issued";

      if (newRemainingPiasters === 0) {
        newStatus = "paid";
      } else if (newPaidPiasters > 0) {
        newStatus = "partially_paid";
      }

      updatedInvoice.paidAmount = paidAmount;
      updatedInvoice.remainingAmount = remainingAmount;
      updatedInvoice.status = newStatus;
      updatedInvoice.updatedBy = currentUser?._id || updatedInvoice.updatedBy;

      await updatedInvoice.save({ session });

      // -----------------------------------------
      // 9. Create Payment Record
      // -----------------------------------------
      const paymentDocData = {
        invoice: updatedInvoice._id,
        patient: patient._id,
        amount: paymentAmountFloat,
        paymentMethod: selectedMethod._id,
        method: selectedMethod.code,
        referenceNumber: refNumber || null,
        transactionReference: refNumber || null,
        notes: notes?.trim() || null,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        receivedBy: currentUser?._id,
        createdBy: currentUser?._id,
      };

      if (normalizedIdempotencyKey) {
        paymentDocData.idempotencyKey = normalizedIdempotencyKey;
      }

      const [payment] = await Payment.create([paymentDocData], { session });

      createdPaymentDoc = payment;

      // -----------------------------------------
      // 10. Audit Log
      // -----------------------------------------
      await auditLogService.logActivity({
        actor: currentUser,
        action: "PAYMENT_CREATED",
        resource: "Payment",
        resourceId: payment._id,
        details: {
          amount: payment.amount,
          method: payment.method,
          paymentMethod: selectedMethod.code,
          referenceNumber: payment.referenceNumber,
          transactionReference: payment.transactionReference,
          invoice: updatedInvoice._id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          previousPaidAmount: invoice.paidAmount,
          newPaidAmount: paidAmount,
          previousRemainingAmount: invoice.remainingAmount,
          newRemainingAmount: remainingAmount,
          status: newStatus,
          idempotencyKey: normalizedIdempotencyKey,
        },
        session,
      });
    });

    // Populate payment details
    const populated = await Payment.findById(createdPaymentDoc._id)
      .populate("paymentMethod", "code nameAr nameEn requiresReference isDefault sortOrder")
      .populate("invoice", "invoiceNumber total paidAmount remainingAmount status issuedAt")
      .populate("patient", "firstName lastName phone email")
      .populate("receivedBy", "firstName lastName email role")
      .populate("createdBy", "firstName lastName email role");

    return populated;
  } finally {
    session.endSession();
  }
};

// ---------------------------------------------
// Reverse Payment (Never edit or delete a payment)
// ---------------------------------------------

const reversePayment = async (paymentId, reason, currentUser) => {
  const session = await mongoose.startSession();
  let reversalRecord = null;

  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findById(paymentId).session(session);

      if (!payment) {
        throw new AppError(
          "سجل الدفعة غير موجود",
          404,
          "PAYMENT_NOT_FOUND"
        );
      }

      if (payment.isReversal) {
        throw new AppError(
          "لا يمكن إلغاء دفعة عكسية",
          400,
          "CANNOT_REVERSE_REVERSAL"
        );
      }

      const existingReversal = await Payment.findOne({
        reversedPayment: payment._id,
      }).session(session);

      if (existingReversal) {
        throw new AppError(
          "تم إلغاء/عكس هذه الدفعة بالفعل مسبقاً",
          400,
          "PAYMENT_ALREADY_REVERSED"
        );
      }

      const invoice = await Invoice.findById(payment.invoice).session(session);
      if (!invoice) {
        throw new AppError(
          "الفاتورة المرتبطة بالدفعة غير موجودة",
          404,
          "INVOICE_NOT_FOUND"
        );
      }

      if (currentUser) {
        await assertDoctorAccess(currentUser, invoice.doctor);
      }

      const reversePiasters = toPiasters(payment.amount);
      const currentPaidPiasters = toPiasters(invoice.paidAmount);
      const currentRemainingPiasters = toPiasters(invoice.remainingAmount);

      const newPaidPiasters = Math.max(0, currentPaidPiasters - reversePiasters);
      const newRemainingPiasters = currentRemainingPiasters + reversePiasters;

      const newPaidAmount = fromPiasters(newPaidPiasters);
      const newRemainingAmount = fromPiasters(newRemainingPiasters);

      let newStatus = "issued";
      if (newRemainingPiasters === 0) {
        newStatus = "paid";
      } else if (newPaidPiasters > 0) {
        newStatus = "partially_paid";
      }

      invoice.paidAmount = newPaidAmount;
      invoice.remainingAmount = newRemainingAmount;
      invoice.status = newStatus;
      invoice.updatedBy = currentUser._id;
      await invoice.save({ session });

      const [reversal] = await Payment.create(
        [
          {
            invoice: invoice._id,
            patient: invoice.patient,
            amount: -payment.amount,
            paymentMethod: payment.paymentMethod,
            method: payment.method,
            referenceNumber: `REV-${payment.referenceNumber || payment._id}`,
            transactionReference: `REV-${payment.transactionReference || payment._id}`,
            notes: `عكس الدفعة رقم ${payment._id}: ${reason}`,
            paidAt: new Date(),
            receivedBy: currentUser._id,
            createdBy: currentUser._id,
            isReversal: true,
            reversedPayment: payment._id,
            reversalReason: reason,
          },
        ],
        { session }
      );

      reversalRecord = reversal;

      await auditLogService.logActivity({
        actor: currentUser,
        action: "PAYMENT_REVERSED",
        resource: "Payment",
        resourceId: payment._id,
        details: {
          originalPaymentId: payment._id,
          reversalPaymentId: reversal._id,
          amount: payment.amount,
          reason,
          invoiceId: invoice._id,
          newPaidAmount,
          newRemainingAmount,
          newStatus,
        },
        session,
      });
    });

    return Payment.findById(reversalRecord._id)
      .populate("paymentMethod")
      .populate("invoice")
      .populate("patient")
      .populate("receivedBy", "firstName lastName email role");
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

  if (query.paymentMethod) {
    filter.paymentMethod = query.paymentMethod;
  }

  if (query.receivedBy) {
    filter.receivedBy = query.receivedBy;
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
      query.invoice &&
      !invoiceIds.some((invoiceId) => invoiceId.toString() === query.invoice)
        ? { $in: [] }
        : { $in: invoiceIds };
  } else if (currentUser?.role === "receptionist") {
    const authorizedDoctorIds = await getAuthorizedDoctorIds(currentUser);
    const invoiceIds = authorizedDoctorIds?.length
      ? await Invoice.distinct("_id", { doctor: { $in: authorizedDoctorIds } })
      : [];

    filter.invoice =
      query.invoice &&
      !invoiceIds.some((invoiceId) => invoiceId.toString() === query.invoice)
        ? { $in: [] }
        : { $in: invoiceIds };
  }

  return paginateQuery(
    Payment.find(filter)
      .populate("patient", "firstName lastName phone email")
      .populate("paymentMethod", "code nameAr nameEn requiresReference isDefault sortOrder")
      .populate(
        "invoice",
        "invoiceNumber total paidAmount remainingAmount status issuedAt"
      )
      .populate("receivedBy", "firstName lastName email role")
      .populate("createdBy", "firstName lastName email role")
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

const getPaymentById = async (id, currentUser = null) => {
  const payment = await Payment.findById(id)
    .populate("patient", "firstName lastName phone email")
    .populate("paymentMethod", "code nameAr nameEn requiresReference isDefault sortOrder")
    .populate(
      "invoice",
      "invoiceNumber total paidAmount remainingAmount status issuedAt doctor"
    )
    .populate("receivedBy", "firstName lastName email role")
    .populate("createdBy", "firstName lastName email role");

  if (!payment) return null;

  if (currentUser) {
    const invoice = await Invoice.findById(
      payment.invoice?._id || payment.invoice
    )
      .select("doctor")
      .lean();
    if (invoice?.doctor) {
      if (currentUser.role === "doctor") {
        const authorizedDoctorIds = await getAuthorizedDoctorIds(currentUser);
        const invDoctorId = invoice.doctor.toString();
        if (
          !authorizedDoctorIds ||
          !authorizedDoctorIds.some((docId) => docId.toString() === invDoctorId)
        ) {
          return null;
        }
      } else {
        await assertDoctorAccess(currentUser, invoice.doctor);
      }
    }
  }

  return payment;
};

// ---------------------------------------------
// Daily Closing Report (Aggregation Pipeline)
// ---------------------------------------------

const getDailyClosing = async ({ date, startDate, endDate } = {}) => {
  let startOfDay;
  let endOfDay;

  if (startDate && endDate) {
    startOfDay = new Date(startDate);
    endOfDay = new Date(endDate);
  } else {
    const targetDate = date ? new Date(date) : new Date();
    // Default to Egypt/Cairo date
    const dateStr = targetDate.toLocaleDateString("en-CA", {
      timeZone: "Africa/Cairo",
    });
    startOfDay = new Date(`${dateStr}T00:00:00.000+02:00`);
    endOfDay = new Date(`${dateStr}T23:59:59.999+02:00`);
  }

  const matchStage = {
    $match: {
      paidAt: { $gte: startOfDay, $lte: endOfDay },
    },
  };

  const [totalsByMethod, totalsByReceptionist, summaryStats] = await Promise.all([
    // 1. Totals per payment method
    Payment.aggregate([
      matchStage,
      {
        $group: {
          _id: { $ifNull: ["$paymentMethod", "$method"] },
          methodCode: { $first: "$method" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "paymentmethods",
          localField: "_id",
          foreignField: "_id",
          as: "methodDoc",
        },
      },
      {
        $unwind: {
          path: "$methodDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          code: { $ifNull: ["$methodDoc.code", "$methodCode"] },
          nameAr: { $ifNull: ["$methodDoc.nameAr", "$methodCode"] },
          nameEn: { $ifNull: ["$methodDoc.nameEn", "$methodCode"] },
          totalAmount: { $round: ["$totalAmount", 2] },
          count: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),

    // 2. Totals per receptionist (receivedBy)
    Payment.aggregate([
      matchStage,
      {
        $group: {
          _id: {
            receivedBy: "$receivedBy",
            method: { $ifNull: ["$paymentMethod", "$method"] },
          },
          methodCode: { $first: "$method" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id.receivedBy",
          foreignField: "_id",
          as: "staff",
        },
      },
      {
        $unwind: {
          path: "$staff",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "paymentmethods",
          localField: "_id.method",
          foreignField: "_id",
          as: "methodDoc",
        },
      },
      {
        $unwind: {
          path: "$methodDoc",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$_id.receivedBy",
          staffName: {
            $first: {
              $concat: [
                { $ifNull: ["$staff.firstName", ""] },
                " ",
                { $ifNull: ["$staff.lastName", ""] },
              ],
            },
          },
          staffEmail: { $first: "$staff.email" },
          staffRole: { $first: "$staff.role" },
          totalAmount: { $sum: "$totalAmount" },
          totalTransactions: { $sum: "$count" },
          byMethod: {
            $push: {
              code: { $ifNull: ["$methodDoc.code", "$methodCode"] },
              nameAr: { $ifNull: ["$methodDoc.nameAr", "$methodCode"] },
              nameEn: { $ifNull: ["$methodDoc.nameEn", "$methodCode"] },
              totalAmount: { $round: ["$totalAmount", 2] },
              count: "$count",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          staffName: { $trim: { input: "$staffName" } },
          staffEmail: 1,
          staffRole: 1,
          totalAmount: { $round: ["$totalAmount", 2] },
          totalTransactions: 1,
          byMethod: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),

    // 3. Day Summary
    Payment.aggregate([
      matchStage,
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$amount" },
          totalTransactions: { $sum: 1 },
          reversalsCount: {
            $sum: { $cond: [{ $eq: ["$isReversal", true] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const summary = summaryStats[0] || {
    totalCollected: 0,
    totalTransactions: 0,
    reversalsCount: 0,
  };

  return {
    dateRange: {
      start: startOfDay,
      end: endOfDay,
    },
    totalCollected: roundMoney(summary.totalCollected),
    totalTransactions: summary.totalTransactions,
    reversalsCount: summary.reversalsCount,
    totalsByMethod,
    totalsByReceptionist,
  };
};

module.exports = {
  createPayment,
  reversePayment,
  getPayments,
  getPaymentById,
  getDailyClosing,
};
