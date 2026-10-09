const router = require("express").Router();

const auditLogController = require("./auditLog.controller");

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const validate = require("../../middlewares/validation");

const {
  createAuditLogSchema,
  auditLogListQuerySchema,
} = require("./auditLog.validation");
const { validateQuery, validateId } = validate;

router.post(
  "/",
  protect,
  authorize("admin"),
  validate(createAuditLogSchema),
  auditLogController.createAuditLog
);

router.get(
  "/",
  protect,
  authorize("admin"),
  validateQuery(auditLogListQuerySchema),
  auditLogController.getAuditLogs
);

router.get(
  "/:id",
  protect,
  authorize("admin"),
  validateId("id"),
  auditLogController.getAuditLogById
);

module.exports = router;