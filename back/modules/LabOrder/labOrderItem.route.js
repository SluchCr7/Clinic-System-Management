const router = require("express").Router();
const labOrderController = require("./labOrder.controller");
const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const validate = require("../../middlewares/validation");
const { labResultUpload } = require("../../middlewares/labResultUpload");
const { updateLabOrderItemSchema } = require("./labOrder.validation");
const { validateId } = validate;

// Doctor only: update order item status, center name, notes, files
router.patch(
  "/:id",
  protect,
  authorize("doctor"),
  validateId("id"),
  labResultUpload.array("files", 10),
  validate(updateLabOrderItemSchema),
  labOrderController.updateLabOrderItem
);

// File upload endpoint for items
router.post(
  "/:id/files",
  protect,
  authorize("doctor"),
  validateId("id"),
  labResultUpload.array("files", 10),
  labOrderController.updateLabOrderItem
);

// File deletion endpoint for items
router.delete(
  "/:id/files/:fileId",
  protect,
  authorize("doctor"),
  validateId("id"),
  validateId("fileId"),
  labOrderController.deleteLabOrderItemFile
);

// File serving endpoint
router.get(
  "/:id/files/:fileId",
  protect,
  authorize("doctor", "receptionist"),
  validateId("id"),
  validateId("fileId"),
  labOrderController.serveLabResultFile
);

module.exports = router;
