const asyncHandler = require("express-async-handler");

const auditLogService = require("./auditLog.service");

const { AppError } = require("../../middlewares/errorHandler");

const createAuditLog = asyncHandler(async (req, res) => {
  const auditLog = await auditLogService.createAuditLog(
    req.body,
    req.user,
    {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    }
  );

  res.status(201).json({
    success: true,
    message: "Audit log created successfully",
    data: auditLog,
  });
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const { data: auditLogs, pagination } = await auditLogService.getAuditLogs(
    req.validatedQuery
  );

  res.status(200).json({
    success: true,
    data: auditLogs,
    pagination,
  });
});

const getAuditLogById = asyncHandler(async (req, res) => {
  const auditLog = await auditLogService.getAuditLogById(
    req.params.id
  );

  if (!auditLog) {
    throw new AppError(
      "Audit log not found",
      404,
      "AUDIT_LOG_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    data: auditLog,
  });
});

module.exports = {
  createAuditLog,
  getAuditLogs,
  getAuditLogById,
};