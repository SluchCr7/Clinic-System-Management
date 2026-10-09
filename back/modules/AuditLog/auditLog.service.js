const AuditLog = require("./auditLog.model");
const User = require("../User/user.model");

const { AppError } = require("../../middlewares/errorHandler");
const { paginateQuery } = require("../../utils/pagination");
const { getSort, applyCairoDateRange } = require("../../utils/listQuery");

const validateActor = async (actorId) => {
  const user = await User.findById(actorId);

  if (!user) {
    throw new AppError(
      "Actor user not found",
      404,
      "ACTOR_NOT_FOUND"
    );
  }

  if (!user.isActive) {
    throw new AppError(
      "Actor account is inactive",
      403,
      "ACTOR_INACTIVE"
    );
  }

  return user;
};

const createAuditLog = async (
  data,
  currentUser,
  requestInfo = {}
) => {
  if (!currentUser?._id) {
    throw new AppError(
      "Authenticated user is required",
      401,
      "UNAUTHORIZED"
    );
  }

  await validateActor(currentUser._id);

  const {
    action,
    resource,
    resourceId,
    details,
  } = data;

  const auditLog = await AuditLog.create({
    actor: currentUser._id,
    action,
    resource,
    resourceId: resourceId || null,
    details: details || null,
    ipAddress: requestInfo.ipAddress || null,
    userAgent: requestInfo.userAgent || null,
  });

  return auditLog;
};

const logActivity = async ({
  actor,
  action,
  resource,
  resourceId = null,
  details = null,
  ipAddress = null,
  userAgent = null,
  session = null,
}) => {
  if (!actor?._id) {
    throw new AppError(
      "Audit actor is required",
      400,
      "AUDIT_ACTOR_REQUIRED"
    );
  }

  const auditData = {
    actor: actor._id,
    action,
    resource,
    resourceId,
    details,
    ipAddress,
    userAgent,
  };

  if (session) {
    const [auditLog] = await AuditLog.create(
      [auditData],
      { session }
    );

    return auditLog;
  }

  return await AuditLog.create(auditData);
};

const getAuditLogs = async (query = {}) => {
  const filter = {};

  if (query.actor) {
    filter.actor = query.actor;
  }

  if (query.action) {
    filter.action = query.action;
  }

  if (query.resource) {
    filter.resource = query.resource;
  }

  if (query.resourceId) {
    filter.resourceId = query.resourceId;
  }

  applyCairoDateRange(filter, "createdAt", query);

  return paginateQuery(
    AuditLog.find(filter)
      .populate(
        "actor",
        "firstName lastName email role"
      )
      .sort(
        getSort(
          query,
          ["createdAt", "updatedAt", "action", "resource"],
          "createdAt"
        )
      ),
    AuditLog.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getAuditLogById = async (id) => {
  return await AuditLog.findById(id).populate(
    "actor",
    "firstName lastName email role"
  );
};

module.exports = {
  createAuditLog,
  logActivity,
  getAuditLogs,
  getAuditLogById,
};