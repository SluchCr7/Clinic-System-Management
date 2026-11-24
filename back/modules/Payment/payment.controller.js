const asyncHandler = require("express-async-handler");
const paymentService = require("./payment.service");
const { AppError } = require("../../middlewares/errorHandler");

// ---------------------------------------------
// Create Payment
// ---------------------------------------------
const createPayment = asyncHandler(async (req, res) => {
  const idempotencyKey =
    req.headers["idempotency-key"] ||
    req.headers["x-idempotency-key"] ||
    req.body.idempotencyKey;

  const invoiceId = req.params.id || req.body.invoice;

  const paymentData = {
    ...req.body,
    invoice: invoiceId,
    idempotencyKey,
  };

  const payment = await paymentService.createPayment(
    paymentData,
    req.user
  );

  res.status(201).json({
    success: true,
    message: "تم تسجيل الدفعة بنجاح",
    data: payment,
  });
});

// ---------------------------------------------
// Reverse / Cancel Payment Record
// ---------------------------------------------
const reversePayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.reversePayment(
    req.params.id,
    req.body.reason,
    req.user
  );

  res.status(200).json({
    success: true,
    message: "تم عكس / إلغاء الدفعة بنجاح",
    data: payment,
  });
});

// ---------------------------------------------
// Get Daily Closing Report
// ---------------------------------------------
const getDailyClosing = asyncHandler(async (req, res) => {
  const report = await paymentService.getDailyClosing(req.query);

  res.status(200).json({
    success: true,
    data: report,
  });
});

// ---------------------------------------------
// Get All Payments
// ---------------------------------------------
const getPayments = asyncHandler(async (req, res) => {
  const { data: payments, pagination } = await paymentService.getPayments(
    req.validatedQuery,
    req.user
  );

  res.status(200).json({
    success: true,
    data: payments,
    pagination,
  });
});

// ---------------------------------------------
// Get Payment By ID
// ---------------------------------------------
const getPaymentById = asyncHandler(async (req, res) => {
  const payment = await paymentService.getPaymentById(
    req.params.id,
    req.user
  );

  if (!payment) {
    throw new AppError(
      "سجل الدفعة غير موجود",
      404,
      "PAYMENT_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    data: payment,
  });
});

module.exports = {
  createPayment,
  reversePayment,
  getDailyClosing,
  getPayments,
  getPaymentById,
};
