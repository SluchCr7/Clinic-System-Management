const Schedule = require("./schedule.model");
const Doctor = require("../Doctor/doctor.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const {
  getSort,
  applyDoctorScope,
  getDoctorScopeId,
} = require("../../utils/listQuery");

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};

const validateScheduleTimes = ({
  startTime,
  endTime,
  breakStart,
  breakEnd,
}) => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start >= end) {
    throw new AppError(
      "Start time must be before end time",
      400,
      "INVALID_SCHEDULE_TIME"
    );
  }

  if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
    throw new AppError(
      "Both break start and break end are required",
      400,
      "INVALID_BREAK_TIME"
    );
  }

  if (breakStart && breakEnd) {
    const breakStartMinutes = timeToMinutes(breakStart);
    const breakEndMinutes = timeToMinutes(breakEnd);

    if (breakStartMinutes >= breakEndMinutes) {
      throw new AppError(
        "Break start time must be before break end time",
        400,
        "INVALID_BREAK_TIME"
      );
    }

    if (
      breakStartMinutes < start ||
      breakEndMinutes > end
    ) {
      throw new AppError(
        "Break time must be within working hours",
        400,
        "BREAK_OUTSIDE_WORKING_HOURS"
      );
    }
  }
};

const validateDoctor = async (doctorId) => {
  const doctor = await Doctor.findById(doctorId);

  if (!doctor) {
    throw new AppError(
      "Doctor not found",
      404,
      "DOCTOR_NOT_FOUND"
    );
  }

  if (!doctor.isActive) {
    throw new AppError(
      "Doctor is inactive",
      400,
      "DOCTOR_INACTIVE"
    );
  }

  return doctor;
};

const createSchedule = async (data, currentUser) => {
  await validateDoctor(data.doctor);

  validateScheduleTimes(data);

  const existingSchedule = await Schedule.findOne({
    doctor: data.doctor,
    dayOfWeek: data.dayOfWeek,
  });

  if (existingSchedule) {
    throw new AppError(
      "Schedule already exists for this doctor on this day",
      409,
      "SCHEDULE_ALREADY_EXISTS"
    );
  }

  const schedule = await Schedule.create({
    ...data,
    createdBy: currentUser._id,
  });

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "SCHEDULE_CREATED",
      resource: "Schedule",
      resourceId: schedule._id,
      details: {
        doctor: schedule.doctor,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        breakStart: schedule.breakStart,
        breakEnd: schedule.breakEnd,
        isActive: schedule.isActive,
      },
    });
  }

  return schedule;
};

const getSchedules = async (query = {}, currentUser = null) => {
  const filter = {
    isActive:
      query.isActive === true || query.isActive === "true"
        ? true
        : query.isActive === false || query.isActive === "false"
          ? false
          : true,
  };

  if (query.doctor) {
    filter.doctor = query.doctor;
  }

  if (query.dayOfWeek !== undefined) {
    filter.dayOfWeek = Number(query.dayOfWeek);
  }
  await applyDoctorScope(filter, query, currentUser, Doctor);

  return paginateQuery(
    Schedule.find(filter)
      .populate(
        "doctor",
        "specialization licenseNumber consultationFee profilePhoto"
      )
      .sort(
        getSort(
          query,
          [
            "doctor",
            "dayOfWeek",
            "startTime",
            "endTime",
            "createdAt",
          ],
          "doctor",
          "asc"
        )
      ),
    Schedule.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getScheduleById = async (id, currentUser = null) => {
  const filter = { _id: id };
  if (currentUser?.role === "doctor") {
    const doctorId = await getDoctorScopeId(currentUser, Doctor);
    if (!doctorId) return null;
    filter.doctor = doctorId;
  }

  return await Schedule.findOne(filter).populate(
    "doctor",
    "specialization licenseNumber consultationFee profilePhoto"
  );
};

const updateSchedule = async (id, data, currentUser) => {
  const schedule = await Schedule.findById(id);

  if (!schedule) {
    return null;
  }

  const previousValues = {
    doctor: schedule.doctor,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    breakStart: schedule.breakStart,
    breakEnd: schedule.breakEnd,
    isActive: schedule.isActive,
  };

  const updatedData = {
    doctor: schedule.doctor,
    dayOfWeek:
      data.dayOfWeek !== undefined
        ? data.dayOfWeek
        : schedule.dayOfWeek,

    startTime:
      data.startTime !== undefined
        ? data.startTime
        : schedule.startTime,

    endTime:
      data.endTime !== undefined
        ? data.endTime
        : schedule.endTime,

    breakStart:
      data.breakStart !== undefined
        ? data.breakStart
        : schedule.breakStart,

    breakEnd:
      data.breakEnd !== undefined
        ? data.breakEnd
        : schedule.breakEnd,
  };

  validateScheduleTimes(updatedData);

  const conflictingSchedule = await Schedule.findOne({
    _id: { $ne: id },
    doctor: schedule.doctor,
    dayOfWeek: updatedData.dayOfWeek,
    isActive: true,
  });

  if (conflictingSchedule) {
    throw new AppError(
      "Another schedule already exists for this doctor on this day",
      409,
      "SCHEDULE_ALREADY_EXISTS"
    );
  }

  const allowedFields = [
    "dayOfWeek",
    "startTime",
    "endTime",
    "breakStart",
    "breakEnd",
    "isActive",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      schedule[field] = data[field];
    }
  }

  schedule.updatedBy = currentUser._id;

  await schedule.save();

  const newValues = {
    doctor: schedule.doctor,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    breakStart: schedule.breakStart,
    breakEnd: schedule.breakEnd,
    isActive: schedule.isActive,
  };

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "SCHEDULE_UPDATED",
      resource: "Schedule",
      resourceId: schedule._id,
      details: {
        previousValues,
        newValues,
      },
    });
  }

  return schedule;
};

const deactivateSchedule = async (id, currentUser) => {
  const schedule = await Schedule.findById(id);

  if (!schedule) {
    return null;
  }

  const previousIsActive = schedule.isActive;
  schedule.isActive = false;
  schedule.updatedBy = currentUser._id;

  await schedule.save();

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "SCHEDULE_DEACTIVATED",
      resource: "Schedule",
      resourceId: schedule._id,
      details: {
        previousIsActive,
        newIsActive: false,
      },
    });
  }

  return schedule;
};

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deactivateSchedule,
};