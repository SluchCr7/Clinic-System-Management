const asyncHandler = require("express-async-handler")
const scheduleService = require("./schedule.service")
const { AppError } = require("../../middlewares/errorHandler")


const createSchedule = asyncHandler(async (req, res) => {
    const schedule = await scheduleService.createSchedule(
        req.body,
        req.user
    )

    res.status(201).json({
        success: true,
        message: "Schedule created successfully",
        data: schedule,
    });

})

const getSchedules = asyncHandler(async (req, res) => {
    const { data: schedules, pagination } = await scheduleService.getSchedules(
      req.validatedQuery,
      req.user
    )
    res.status(200).json({
        success: true,
        data: schedules,
        pagination,
    });
})

const getScheduleById = asyncHandler(async (req, res) => {
    const schedule = await scheduleService.getScheduleById(req.params.id)

    if (!schedule) {
        throw new AppError(
            "Schedule not found",
            404,
            "SCHEDULE_NOT_FOUND"
        );
    }

    res.status(200).json({
        success: true,
        data: schedule,
    })
})

const updateSchedule = asyncHandler(async (req, res) => {
    const schedule = await scheduleService.updateSchedule(
            req.params.id,
    req.body,
    req.user
  );

  if (!schedule) {
    throw new AppError(
      "Schedule not found",
      404,
      "SCHEDULE_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Schedule updated successfully",
    data: schedule,
  });
});

const deactivateSchedule = asyncHandler(async (req, res) => {
  const schedule = await scheduleService.deactivateSchedule(
    req.params.id,
    req.user
  );

  if (!schedule) {
    throw new AppError(
      "Schedule not found",
      404,
      "SCHEDULE_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Schedule deactivated successfully",
  });
});

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deactivateSchedule,
};
