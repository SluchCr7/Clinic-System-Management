const asyncHandler = require("express-async-handler");

const paymentService = require("./payment.service");
const { AppError } = require("../../middlewares/errorHandler");

// ---------------------------------------------
// Create Payment
// ---------------------------------------------

const createPayment = asyncHandler(async (req, res) => {
  const payment = await paymentService.createPayment(
    req.body,
    req.user
  );

  res.status(201).json({
    success: true,
    message: "Payment created successfully",
    data: payment,
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
    req.params.id
  );

  if (!payment) {
    throw new AppError(
      "Payment not found",
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
  getPayments,
  getPaymentById,
};