const router = require("express").Router()
const scheduleController = require("./schedule.controller");

const {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleListQuerySchema,
} = require("./schedule.validation");

const { validate, validateQuery, validateId } = require("../../middlewares/validation");
const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");

// Create Schedule
router.post(
  "/",
  protect,
  authorize("admin", "doctor"),
  validate(createScheduleSchema),
  scheduleController.createSchedule
);

// Get All Schedules
router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(scheduleListQuerySchema),
  scheduleController.getSchedules
);

// Get Schedule By ID
router.get(
  "/:id",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id", "schedule ID"),
  scheduleController.getScheduleById
);

// Update Schedule
router.patch(
  "/:id",
  protect,
  authorize("admin", "doctor"),
  validateId("id", "schedule ID"),
  validate(updateScheduleSchema),
  scheduleController.updateSchedule
);

// Deactivate Schedule
router.delete(
  "/:id",
  protect,
  authorize("admin", "doctor"),
  validateId("id", "schedule ID"),
  scheduleController.deactivateSchedule
);

module.exports = router;
