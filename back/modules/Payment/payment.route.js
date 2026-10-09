const express = require("express");

const router = express.Router();

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const { validate, validateQuery, validateId } = require("../../middlewares/validation");

const paymentController = require("./payment.controller");

const {
  createPaymentSchema,
  paymentListQuerySchema,
} = require("./payment.validation");

// Create Payment
router.post(
  "/",
  protect,
  authorize("admin", "receptionist"),
  validate(createPaymentSchema),
  paymentController.createPayment
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