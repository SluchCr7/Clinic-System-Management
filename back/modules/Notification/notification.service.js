const Notification = require("./notification.model");
const User = require("../User/user.model");

const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const { getSearchRegex, getSort } = require("../../utils/listQuery");
const { getIO } = require("../../utils/socket");
// ---------------------------------------------
// Validate Recipient
// ---------------------------------------------

const validateRecipient = async (recipientId) => {
  const user = await User.findById(recipientId);

  if (!user) {
    throw new AppError(
      "Recipient user not found",
      404,
      "RECIPIENT_NOT_FOUND"
    );
  }

  if (!user.isActive) {
    throw new AppError(
      "Recipient account is inactive",
      400,
      "RECIPIENT_INACTIVE"
    );
  }

  return user;
};

// ---------------------------------------------
// Create Notification
// ---------------------------------------------

const createNotification = async (
  data,
  currentUser
) => {
  const {
    recipient,
    type,
    title,
    message,
    relatedModel,
    relatedId,
  } = data;

  await validateRecipient(recipient);

  if (relatedModel && !relatedId) {
    throw new AppError(
      "relatedId is required when relatedModel is provided",
      400,
      "RELATED_ID_REQUIRED"
    );
  }

  if (relatedId && !relatedModel) {
    throw new AppError(
      "relatedModel is required when relatedId is provided",
      400,
      "RELATED_MODEL_REQUIRED"
    );
  }

  const notification = await Notification.create({
    recipient,
    type,
    title,
    message,
    relatedModel: relatedModel || null,
    relatedId: relatedId || null,
    createdBy: currentUser?._id || null,
  });
  const io = getIO();

  io.to(`user:${recipient}`).emit("notification:new", {
    notification,
  });
  // ---------------------------------------------
  // Audit Log
  // ---------------------------------------------

  await auditLogService.logActivity({
    actor: currentUser,
    action: "NOTIFICATION_CREATED",
    resource: "Notification",
    resourceId: notification._id,
    details: {
      recipient: notification.recipient,
      type: notification.type,
      title: notification.title,
      relatedModel: notification.relatedModel,
      relatedId: notification.relatedId,
    },
  });

  return notification;
};

// ---------------------------------------------
// Get Notifications
// ---------------------------------------------

const getNotifications = async (
  recipientId,
  query = {}
) => {
  await validateRecipient(recipientId);

  const filter = {
    recipient: recipientId,
  };

  if (query.isRead !== undefined) {
    filter.isRead =
      query.isRead === true || query.isRead === "true";
  }

  if (query.type) {
    filter.type = query.type;
  }

  const searchRegex = getSearchRegex(query.search);
  if (searchRegex) {
    filter.$or = [
      { title: searchRegex },
      { message: searchRegex },
    ];
  }

  return paginateQuery(
    Notification.find(filter)
      .populate(
        "recipient",
        "firstName lastName email role"
      )
      .populate(
        "createdBy",
        "firstName lastName email role"
      )
      .sort(
        getSort(
          query,
          ["createdAt", "updatedAt", "readAt", "type"],
          "createdAt"
        )
      ),
    Notification.countDocuments(filter),
    query.page,
    query.limit
  );
};

// ---------------------------------------------
// Get Notification By ID
// ---------------------------------------------

const getNotificationById = async (
  id,
  recipientId
) => {
  const notification = await Notification.findOne({
    _id: id,
    recipient: recipientId,
  })
    .populate(
      "recipient",
      "firstName lastName email role"
    )
    .populate(
      "createdBy",
      "firstName lastName email role"
    );

  return notification;
};

// ---------------------------------------------
// Get Unread Count
// ---------------------------------------------

const getUnreadCount = async (
  recipientId
) => {
  await validateRecipient(recipientId);

  return await Notification.countDocuments({
    recipient: recipientId,
    isRead: false,
  });
};

// ---------------------------------------------
// Mark Notification As Read
// ---------------------------------------------

const markAsRead = async (
  id,
  recipientId,
  currentUser
) => {
  const notification = await Notification.findOne({
    _id: id,
    recipient: recipientId,
  });

  if (!notification) {
    return null;
  }

  // Already read
  if (notification.isRead) {
    return notification;
  }

  notification.isRead = true;
  notification.readAt = new Date();

  await notification.save();

  // ---------------------------------------------
  // Audit Log
  // ---------------------------------------------

  await auditLogService.logActivity({
    actor: currentUser,
    action: "NOTIFICATION_READ",
    resource: "Notification",
    resourceId: notification._id,
    details: {
      recipient: notification.recipient,
      type: notification.type,
      title: notification.title,
      relatedModel: notification.relatedModel,
      relatedId: notification.relatedId,
      readAt: notification.readAt,
    },
  });

  return notification;
};

// ---------------------------------------------
// Mark All Notifications As Read
// ---------------------------------------------

const markAllAsRead = async (
  recipientId,
  currentUser
) => {
  await validateRecipient(recipientId);

  const readAt = new Date();

  const result = await Notification.updateMany(
    {
      recipient: recipientId,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt,
      },
    }
  );

  // ---------------------------------------------
  // Audit Log
  // ---------------------------------------------

  if (result.modifiedCount > 0) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "NOTIFICATIONS_READ_ALL",
      resource: "Notification",
      details: {
        recipient: recipientId,
        modifiedCount: result.modifiedCount,
        readAt,
      },
    });
  }

  return result;
};

module.exports = {
  createNotification,
  getNotifications,
  getNotificationById,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};