const express = require("express");

const router = express.Router();

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const { validate, validateQuery, validateId } = require("../../middlewares/validation");

const invoiceController = require("./invoice.controller");
const paymentController = require("../Payment/payment.controller");

const {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceListQuerySchema,
  eligibleVisitListQuerySchema,
} = require("./invoice.validation");
const { createPaymentSchema } = require("../Payment/payment.validation");

// Create Invoice
router.post(
  "/",
  protect,
  authorize("receptionist"),
  validate(createInvoiceSchema),
  invoiceController.createInvoice
);

// Get All Invoices
router.get(
  "/eligible-visits",
  protect,
  authorize("admin", "receptionist"),
  validateQuery(eligibleVisitListQuerySchema),
  invoiceController.getEligibleVisits
);

// Get All Invoices
router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(invoiceListQuerySchema),
  invoiceController.getInvoices
);

// Get Invoice By ID
router.get(
  "/:id",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id", "invoice ID"),
  invoiceController.getInvoiceById
);

// Update Invoice
router.patch(
  "/:id",
  protect,
  authorize("doctor", "receptionist"),
  validateId("id", "invoice ID"),
  validate(updateInvoiceSchema),
  invoiceController.updateInvoice
);

// Cancel Invoice
router.post(
  "/:id/cancel",
  protect,
  authorize("admin", "receptionist"),
  validateId("id", "invoice ID"),
  invoiceController.cancelInvoice
);

// Record payment for Invoice (e.g. POST /api/invoices/:id/payments)
router.post(
  "/:id/payments",
  protect,
  authorize("admin", "receptionist"),
  validateId("id", "invoice ID"),
  validate(createPaymentSchema),
  paymentController.createPayment
);

module.exports = router;