const asyncHandler = require("express-async-handler");

const notificationService = require("./notification.service");
const reminderSettingsService = require("./reminderSettings.service");

const { AppError } = require("../../middlewares/errorHandler");

// ---------------------------------------------
// Create Notification
// ---------------------------------------------

const createNotification = asyncHandler(
  async (req, res) => {
    const notification =
      await notificationService.createNotification(
        req.body,
        req.user
      );

    res.status(201).json({
      success: true,
      message:
        "Notification created successfully",
      data: notification,
    });
  }
);

// ---------------------------------------------
// Get My Notifications
// ---------------------------------------------

const getNotifications = asyncHandler(
  async (req, res) => {
    const { data: notifications, pagination } =
      await notificationService.getNotifications(
        req.user._id,
        req.validatedQuery
      );

    res.status(200).json({
      success: true,
      data: notifications,
      pagination,
    });
  }
);

// ---------------------------------------------
// Get Notification By ID
// ---------------------------------------------

const getNotificationById = asyncHandler(
  async (req, res) => {
    const notification =
      await notificationService.getNotificationById(
        req.params.id,
        req.user._id
      );

    if (!notification) {
      throw new AppError(
        "Notification not found",
        404,
        "NOTIFICATION_NOT_FOUND"
      );
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  }
);

// ---------------------------------------------
// Get Unread Count
// ---------------------------------------------

const getUnreadCount = asyncHandler(
  async (req, res) => {
    const count =
      await notificationService.getUnreadCount(
        req.user._id
      );

    res.status(200).json({
      success: true,
      data: {
        unreadCount: count,
      },
    });
  }
);

// ---------------------------------------------
// Mark As Read
// ---------------------------------------------

const markAsRead = asyncHandler(
  async (req, res) => {
    const notification =
      await notificationService.markAsRead(
        req.params.id,
        req.user._id,
        req.user
      );

    if (!notification) {
      throw new AppError(
        "Notification not found",
        404,
        "NOTIFICATION_NOT_FOUND"
      );
    }

    res.status(200).json({
      success: true,
      message:
        "Notification marked as read",
      data: notification,
    });
  }
);

// ---------------------------------------------
// Mark All As Read
// ---------------------------------------------

const markAllAsRead = asyncHandler(
  async (req, res) => {
    const result =
      await notificationService.markAllAsRead(
        req.user._id,
        req.user
      );

    res.status(200).json({
      success: true,
      message:
        "All notifications marked as read",
      data: {
        modifiedCount:
          result.modifiedCount,
      },
    });
  }
);

const getReminderSettings = asyncHandler(async (req, res) => {
  const settings =
    await reminderSettingsService.getReminderSettings();

  res.status(200).json({
    success: true,
    data: settings,
  });
});

const updateReminderSettings = asyncHandler(async (req, res) => {
  const settings =
    await reminderSettingsService.updateReminderSettings(
      req.body,
      req.user
    );

  res.status(200).json({
    success: true,
    message: "Appointment reminder settings updated",
    data: settings,
  });
});

module.exports = {
  createNotification,
  getNotifications,
  getNotificationById,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getReminderSettings,
  updateReminderSettings,
};