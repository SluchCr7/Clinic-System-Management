const asyncHandler = require("express-async-handler");
const labOrderService = require("./labOrder.service");
const { AppError } = require("../../middlewares/errorHandler");
const path = require("path");

// ---------------------------------------------
// 1. Create Lab Order (Doctor Only)
// ---------------------------------------------
const createLabOrder = asyncHandler(async (req, res) => {
  const labOrder = await labOrderService.createLabOrder(req.body, req.user);
  res.status(201).json({
    success: true,
    message: "Lab order created successfully",
    data: labOrder,
  });
});

// ---------------------------------------------
// 2. Get Grouped Lab Orders (Doctor & Staff)
// ---------------------------------------------
const getGroupedLabOrders = asyncHandler(async (req, res) => {
  const { data, pagination } = await labOrderService.getGroupedLabOrders(
    req.query,
    req.user
  );
  res.status(200).json({
    success: true,
    data,
    pagination,
  });
});

// ---------------------------------------------
// 3. Update Lab Order Item (Doctor Only)
// ---------------------------------------------
const updateLabOrderItem = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  const result = await labOrderService.updateLabOrderItem(
    req.params.id,
    req.body,
    files,
    req.user
  );

  res.status(200).json({
    success: true,
    message: "Lab order item updated successfully",
    data: result,
  });
});

// ---------------------------------------------
// 4. File Management
// ---------------------------------------------
const deleteLabOrderItemFile = asyncHandler(async (req, res) => {
  await labOrderService.deleteLabOrderItemFile(
    req.params.id,
    req.params.fileId,
    req.user
  );

  res.status(200).json({
    success: true,
    message: "File deleted successfully",
  });
});

const serveLabResultFile = asyncHandler(async (req, res) => {
  const fileRecord = await labOrderService.getLabResultFileRecord(
    req.params.id,
    req.params.fileId,
    req.user
  );

  res.setHeader("Content-Type", fileRecord.mimeType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(fileRecord.originalName)}"`
  );
  res.sendFile(path.resolve(fileRecord.path));
});

// ---------------------------------------------
// 5. Patient Pending Orders (For Follow-Up Visits)
// ---------------------------------------------
const getPendingOrdersByPatient = asyncHandler(async (req, res) => {
  const currentVisitId = req.query.currentVisitId || null;
  const items = await labOrderService.getPendingOrdersByPatient(
    req.params.patientId,
    req.user,
    currentVisitId
  );

  res.status(200).json({
    success: true,
    data: items,
  });
});

// ---------------------------------------------
// 6. Backward Compatibility Handlers
// ---------------------------------------------
const getLabOrders = getGroupedLabOrders;

const getLabOrderById = asyncHandler(async (req, res) => {
  const labOrder = await labOrderService.getLabOrderById(
    req.params.id,
    req.user
  );
  res.status(200).json({
    success: true,
    data: labOrder,
  });
});

const updateLabOrder = asyncHandler(async (req, res) => {
  const labOrder = await labOrderService.updateLabOrder(
    req.params.id,
    req.body,
    req.user
  );
  res.status(200).json({
    success: true,
    message: "Lab order updated successfully",
    data: labOrder,
  });
});

module.exports = {
  createLabOrder,
  getGroupedLabOrders,
  getLabOrders,
  getLabOrderById,
  updateLabOrder,
  updateLabOrderItem,
  deleteLabOrderItemFile,
  serveLabResultFile,
  getPendingOrdersByPatient,
};
