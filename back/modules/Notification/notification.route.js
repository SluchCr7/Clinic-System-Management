const router = require("express").Router();

const notificationController = require("./notification.controller");

const protect = require("../../middlewares/auth");

const authorize = require("../../middlewares/authorize");

const validate = require("../../middlewares/validation");

const {
  createNotificationSchema,
  notificationListQuerySchema,
  reminderSettingsSchema,
} = require("./notification.validation");
const { validateQuery, validateId } = validate;

// ---------------------------------------------
// Create Notification
// ---------------------------------------------

router.post(
  "/",
  protect,
  authorize("admin"),
  validate(createNotificationSchema),
  notificationController.createNotification
);

// ---------------------------------------------
// Get My Notifications
// ---------------------------------------------

router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(notificationListQuerySchema),
  notificationController.getNotifications
);

// ---------------------------------------------
// Get Unread Count
// IMPORTANT: Must be before /:id
// ---------------------------------------------

router.get(
  "/unread-count",
  protect,
  authorize("admin", "doctor", "receptionist"),
  notificationController.getUnreadCount
);

// ---------------------------------------------
// Mark All As Read
// IMPORTANT: Must be before /:id
// ---------------------------------------------

router.patch(
  "/read-all",
  protect,
  authorize("admin", "doctor", "receptionist"),
  notificationController.markAllAsRead
);

router.get(
  "/reminder-settings",
  protect,
  authorize("admin"),
  notificationController.getReminderSettings
);

router.patch(
  "/reminder-settings",
  protect,
  authorize("admin"),
  validate(reminderSettingsSchema),
  notificationController.updateReminderSettings
);

// ---------------------------------------------
// Get Notification By ID
// ---------------------------------------------

router.get(
  "/:id",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id"),
  notificationController.getNotificationById
);

// ---------------------------------------------
// Mark Notification As Read
// ---------------------------------------------

router.patch(
  "/:id/read",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id"),
  notificationController.markAsRead
);

module.exports = router;