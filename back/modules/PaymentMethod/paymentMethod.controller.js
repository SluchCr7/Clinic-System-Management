const asyncHandler = require("express-async-handler");
const paymentMethodService = require("./paymentMethod.service");

// ---------------------------------------------
// Get Active Payment Methods (Public/Auth users)
// ---------------------------------------------
const getActivePaymentMethods = asyncHandler(async (req, res) => {
  const methods = await paymentMethodService.getActivePaymentMethods();

  res.status(200).json({
    success: true,
    data: methods,
  });
});

// ---------------------------------------------
// Get All Payment Methods (Admin only)
// ---------------------------------------------
const getAllPaymentMethods = asyncHandler(async (req, res) => {
  const methods = await paymentMethodService.getAllPaymentMethods();

  res.status(200).json({
    success: true,
    data: methods,
  });
});

// ---------------------------------------------
// Get Payment Method by ID
// ---------------------------------------------
const getPaymentMethodById = asyncHandler(async (req, res) => {
  const method = await paymentMethodService.getPaymentMethodById(req.params.id);

  res.status(200).json({
    success: true,
    data: method,
  });
});

// ---------------------------------------------
// Create Payment Method (Admin only)
// ---------------------------------------------
const createPaymentMethod = asyncHandler(async (req, res) => {
  const method = await paymentMethodService.createPaymentMethod(req.body);

  res.status(201).json({
    success: true,
    message: "تم إنشاء طريقة الدفع بنجاح",
    data: method,
  });
});

// ---------------------------------------------
// Update Payment Method (Admin only)
// ---------------------------------------------
const updatePaymentMethod = asyncHandler(async (req, res) => {
  const method = await paymentMethodService.updatePaymentMethod(
    req.params.id,
    req.body
  );

  res.status(200).json({
    success: true,
    message: "تم تحديث طريقة الدفع بنجاح",
    data: method,
  });
});

module.exports = {
  getActivePaymentMethods,
  getAllPaymentMethods,
  getPaymentMethodById,
  createPaymentMethod,
  updatePaymentMethod,
};
