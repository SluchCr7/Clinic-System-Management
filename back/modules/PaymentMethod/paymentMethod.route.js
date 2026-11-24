const express = require("express");
const router = express.Router();

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const { validate, validateId } = require("../../middlewares/validation");

const paymentMethodController = require("./paymentMethod.controller");
const {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
} = require("./paymentMethod.validation");

// ---------------------------------------------
// Routes
// ---------------------------------------------

// Get Active Payment Methods (for billing/receptionists)
router.get(
  "/",
  protect,
  authorize("admin", "receptionist", "doctor"),
  paymentMethodController.getActivePaymentMethods
);

// Get All Payment Methods (including inactive, admin only)
router.get(
  "/all",
  protect,
  authorize("admin"),
  paymentMethodController.getAllPaymentMethods
);

// Get Payment Method by ID
router.get(
  "/:id",
  protect,
  authorize("admin", "receptionist", "doctor"),
  validateId("id", "payment method ID"),
  paymentMethodController.getPaymentMethodById
);

// Create Payment Method (admin only)
router.post(
  "/",
  protect,
  authorize("admin"),
  validate(createPaymentMethodSchema),
  paymentMethodController.createPaymentMethod
);

// Update / Enable / Disable Payment Method (admin only)
router.patch(
  "/:id",
  protect,
  authorize("admin"),
  validateId("id", "payment method ID"),
  validate(updatePaymentMethodSchema),
  paymentMethodController.updatePaymentMethod
);

module.exports = router;
