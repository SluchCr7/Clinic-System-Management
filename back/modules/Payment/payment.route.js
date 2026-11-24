const express = require("express");
const router = express.Router();

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const {
  validate,
  validateQuery,
  validateId,
} = require("../../middlewares/validation");

const paymentController = require("./payment.controller");
const {
  createPaymentSchema,
  reversePaymentSchema,
  paymentListQuerySchema,
} = require("./payment.validation");

// Daily Closing Report (must be declared before :id route)
router.get(
  "/daily-closing",
  protect,
  authorize("admin", "receptionist"),
  paymentController.getDailyClosing
);

// Create Payment
router.post(
  "/",
  protect,
  authorize("admin", "receptionist"),
  validate(createPaymentSchema),
  paymentController.createPayment
);

// Reverse / Cancel Payment Record
router.post(
  "/:id/reverse",
  protect,
  authorize("admin", "receptionist"),
  validateId("id", "payment ID"),
  validate(reversePaymentSchema),
  paymentController.reversePayment
);

// Get All Payments
router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(paymentListQuerySchema),
  paymentController.getPayments
);

// Get Payment By ID
router.get(
  "/:id",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id", "payment ID"),
  paymentController.getPaymentById
);

module.exports = router;
