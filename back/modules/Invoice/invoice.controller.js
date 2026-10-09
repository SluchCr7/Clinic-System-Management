const asyncHandler = require("express-async-handler");

const invoiceService = require("./invoice.service");
const { AppError } = require("../../middlewares/errorHandler");

// ---------------------------------------------
// Create Invoice
// ---------------------------------------------

const createInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.createInvoice(
    req.body,
    req.user
  );

  res.status(201).json({
    success: true,
    message: "Invoice created successfully",
    data: invoice,
  });
});

// ---------------------------------------------
// Get All Invoices
// ---------------------------------------------

const getInvoices = asyncHandler(async (req, res) => {
  const { data: invoices, pagination } = await invoiceService.getInvoices(
    req.validatedQuery,
    req.user
  );

  res.status(200).json({
    success: true,
    data: invoices,
    pagination,
  });
});

// ---------------------------------------------
// Get Invoice By ID
// ---------------------------------------------

const getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById(
    req.params.id
  );

  if (!invoice) {
    throw new AppError(
      "Invoice not found",
      404,
      "INVOICE_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    data: invoice,
  });
});

// ---------------------------------------------
// Update Invoice
// ---------------------------------------------

const updateInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.updateInvoice(
    req.params.id,
    req.body,
    req.user
  );

  if (!invoice) {
    throw new AppError(
      "Invoice not found",
      404,
      "INVOICE_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Invoice updated successfully",
    data: invoice,
  });
});

// ---------------------------------------------
// Cancel Invoice
// ---------------------------------------------

const cancelInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.cancelInvoice(
    req.params.id,
    req.user
  );

  if (!invoice) {
    throw new AppError(
      "Invoice not found",
      404,
      "INVOICE_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Invoice cancelled successfully",
    data: invoice,
  });
});

module.exports = {
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  cancelInvoice,
};