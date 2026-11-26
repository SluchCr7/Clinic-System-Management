const router = require("express").Router();
const labOrderController = require("./labOrder.controller");
const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const validate = require("../../middlewares/validation");
const { labResultUpload } = require("../../middlewares/labResultUpload");

const {
  createLabOrderSchema,
  updateLabOrderItemSchema,
  updateLabOrderSchema,
  groupedLabOrdersQuerySchema,
} = require("./labOrder.validation");
const { validateQuery, validateId } = validate;

// ---------------------------------------------
// 1. Grouped List & Queries (Doctor & Staff, Admin 403)
// ---------------------------------------------

router.get(
  "/",
  protect,
  authorize("doctor", "receptionist"),
  validateQuery(groupedLabOrdersQuerySchema),
  labOrderController.getGroupedLabOrders
);

router.get(
  "/grouped",
  protect,
  authorize("doctor", "receptionist"),
  validateQuery(groupedLabOrdersQuerySchema),
  labOrderController.getGroupedLabOrders
);

router.get(
  "/pending/:patientId",
  protect,
  authorize("doctor", "receptionist"),
  validateId("patientId"),
  labOrderController.getPendingOrdersByPatient
);

// ---------------------------------------------
// 2. Item Updates & Files (Doctor Only)
// ---------------------------------------------

router.patch(
  "/items/:id",
  protect,
  authorize("doctor"),
  validateId("id"),
  labResultUpload.array("files", 10),
  validate(updateLabOrderItemSchema),
  labOrderController.updateLabOrderItem
);

router.post(
  "/items/:id/files",
  protect,
  authorize("doctor"),
  validateId("id"),
  labResultUpload.array("files", 10),
  labOrderController.updateLabOrderItem
);

router.delete(
  "/items/:id/files/:fileId",
  protect,
  authorize("doctor"),
  validateId("id"),
  validateId("fileId"),
  labOrderController.deleteLabOrderItemFile
);

// File serving (Doctor & Staff, Admin 403)
router.get(
  "/items/:id/files/:fileId",
  protect,
  authorize("doctor", "receptionist"),
  validateId("id"),
  validateId("fileId"),
  labOrderController.serveLabResultFile
);

// ---------------------------------------------
// 3. Lab Order Creation & Specific Order (Doctor Only)
// ---------------------------------------------

router.post(
  "/",
  protect,
  authorize("doctor"),
  validate(createLabOrderSchema),
  labOrderController.createLabOrder
);

router.get(
  "/:id",
  protect,
  authorize("doctor", "receptionist"),
  validateId("id"),
  labOrderController.getLabOrderById
);

router.patch(
  "/:id",
  protect,
  authorize("doctor"),
  validateId("id"),
  validate(updateLabOrderSchema),
  labOrderController.updateLabOrder
);

module.exports = router;
