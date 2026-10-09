const express = require("express");

const router = express.Router();

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const { validate, validateQuery, validateId } = require("../../middlewares/validation");

const invoiceController = require("./invoice.controller");

const {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceListQuerySchema,
} = require("./invoice.validation");

// Create Invoice
router.post(
  "/",
  protect,
  authorize("admin", "receptionist"),
  validate(createInvoiceSchema),
  invoiceController.createInvoice
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
  authorize("admin"),
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

module.exports = router;