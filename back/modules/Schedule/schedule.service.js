const Schedule = require("./schedule.model");
const Doctor = require("../Doctor/doctor.model");
const Clinic = require("../Clinic/clinic.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const {
  getSort,
  applyDoctorScope,
  getDoctorScopeId,
} = require("../../utils/listQuery");
const {
  assertDoctorAccess,
  applyClinicScope,
  getAuthorizedDoctorIds,
} = require("../../utils/accessControl");

const DAY_INDEX_TO_NAME = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const getClinicForDoctor = async (doctorId) => {
  const doctor = await Doctor.findById(doctorId).select("clinic").lean();
  if (doctor?.clinic) {
    const clinic = await Clinic.findById(doctor.clinic).lean();
    if (clinic) return clinic;
  }
  return await Clinic.findOne({ owner_doctor_id: doctorId }).lean();
};

const validateScheduleAgainstClinic = (clinic, dayOfWeek, { startTime, endTime, isActive }) => {
  if (isActive === false) return;
  if (!clinic?.working_hours) return;

  const dayName = DAY_INDEX_TO_NAME[dayOfWeek];
  const clinicDay = clinic.working_hours[dayName];
  if (!clinicDay) return;

  if (clinicDay.closed) {
    throw new AppError(
      `Clinic is closed on ${dayName}. Doctor schedule cannot be active on a closed day.`,
      400,
      "CLINIC_CLOSED_ON_DAY"
    );
  }

  if (clinicDay.emergency && !clinicDay.open) {
    throw new AppError(
      `Clinic is open for emergencies only on ${dayName} with no standard operating hours.`,
      400,
      "CLINIC_EMERGENCY_ONLY"
    );
  }

  if (clinicDay.open && clinicDay.close) {
    const clinicOpen = timeToMinutes(clinicDay.open);
    const clinicClose = timeToMinutes(clinicDay.close);
    const docStart = timeToMinutes(startTime);
    const docEnd = timeToMinutes(endTime);

    if (docStart < clinicOpen || docEnd > clinicClose) {
      throw new AppError(
        `Doctor schedule (${startTime} - ${endTime}) must be within clinic operating hours (${clinicDay.open} - ${clinicDay.close}) on ${dayName}`,
        400,
        "SCHEDULE_OUTSIDE_CLINIC_HOURS"
      );
    }
  }
};

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
  if (currentUser?.role !== "doctor" && !data.doctor) {
    throw new AppError(
      "Doctor is required to create a schedule",
      400,
      "DOCTOR_REQUIRED"
    );
  }

  const doctorId =
    currentUser?.role === "doctor"
      ? await getDoctorScopeId(currentUser, Doctor)
      : data.doctor;

  if (!doctorId) {
    throw new AppError(
      "A doctor profile is required to create a schedule",
      404,
      "DOCTOR_PROFILE_NOT_FOUND"
    );
  }

  if (
    currentUser?.role === "doctor" &&
    data.doctor &&
    data.doctor.toString() !== doctorId.toString()
  ) {
    throw new AppError(
      "Doctors can only create schedules for their own profile",
      403,
      "FORBIDDEN"
    );
  }

  await validateDoctor(doctorId);

  validateScheduleTimes(data);

  const clinic = await getClinicForDoctor(doctorId);
  if (clinic) {
    validateScheduleAgainstClinic(clinic, data.dayOfWeek, data);
  }

  const existingSchedule = await Schedule.findOne({
    doctor: doctorId,
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
    doctor: doctorId,
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
  await applyClinicScope(filter, query, currentUser, "doctor");

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
  const schedule = await Schedule.findById(id).populate(
    "doctor",
    "specialization licenseNumber consultationFee profilePhoto"
  );

  if (!schedule) return null;

  if (currentUser) {
    if (currentUser.role === "doctor") {
      const authorizedDoctorIds = await getAuthorizedDoctorIds(currentUser);
      const schedDoctorId = (
        schedule.doctor?._id || schedule.doctor
      ).toString();
      if (
        !authorizedDoctorIds ||
        !authorizedDoctorIds.some((d) => d.toString() === schedDoctorId)
      ) {
        return null;
      }
    } else {
      await assertDoctorAccess(
        currentUser,
        schedule.doctor?._id || schedule.doctor
      );
    }
  }

  return schedule;
};

const updateSchedule = async (id, data, currentUser) => {
  const filter = { _id: id };
  if (currentUser?.role === "doctor") {
    const doctorId = await getDoctorScopeId(currentUser, Doctor);
    if (!doctorId) return null;
    filter.doctor = doctorId;
  }

  const schedule = await Schedule.findOne(filter);

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

  const clinic = await getClinicForDoctor(schedule.doctor);
  if (clinic) {
    validateScheduleAgainstClinic(clinic, updatedData.dayOfWeek, {
      ...updatedData,
      isActive: data.isActive !== undefined ? data.isActive : schedule.isActive,
    });
  }

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
  const filter = { _id: id };
  if (currentUser?.role === "doctor") {
    const doctorId = await getDoctorScopeId(currentUser, Doctor);
    if (!doctorId) return null;
    filter.doctor = doctorId;
  }

  const schedule = await Schedule.findOne(filter);

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

const syncDoctorScheduleWithClinic = async (currentUser) => {
  if (currentUser?.role !== "doctor") {
    throw new AppError("Only doctors can sync schedule with clinic", 403, "FORBIDDEN");
  }

  const doctorId = await getDoctorScopeId(currentUser, Doctor);
  if (!doctorId) {
    throw new AppError("Doctor profile not found", 404, "DOCTOR_PROFILE_NOT_FOUND");
  }

  const clinic = await getClinicForDoctor(doctorId);
  if (!clinic || !clinic.working_hours) {
    throw new AppError("Clinic operating hours not found", 404, "CLINIC_NOT_FOUND");
  }

  const updatedSchedules = [];

  for (let day = 0; day <= 6; day++) {
    const dayName = DAY_INDEX_TO_NAME[day];
    const clinicDay = clinic.working_hours[dayName];
    if (!clinicDay) continue;

    let schedule = await Schedule.findOne({
      doctor: doctorId,
      dayOfWeek: day,
    });

    if (clinicDay.closed || (clinicDay.emergency && !clinicDay.open)) {
      if (schedule && schedule.isActive) {
        schedule.isActive = false;
        schedule.updatedBy = currentUser._id;
        await schedule.save();
        updatedSchedules.push(schedule);
      }
    } else if (clinicDay.open && clinicDay.close) {
      const cs = timeToMinutes(clinicDay.open);
      const ce = timeToMinutes(clinicDay.close);

      if (schedule) {
        schedule.startTime = clinicDay.open;
        schedule.endTime = clinicDay.close;
        schedule.isActive = true;
        if (schedule.breakStart && schedule.breakEnd) {
          const bs = timeToMinutes(schedule.breakStart);
          const be = timeToMinutes(schedule.breakEnd);
          if (bs < cs || be > ce) {
            schedule.breakStart = null;
            schedule.breakEnd = null;
          }
        }
        schedule.updatedBy = currentUser._id;
        await schedule.save();
        updatedSchedules.push(schedule);
      } else {
        schedule = await Schedule.create({
          doctor: doctorId,
          dayOfWeek: day,
          startTime: clinicDay.open,
          endTime: clinicDay.close,
          isActive: true,
          createdBy: currentUser._id,
        });
        updatedSchedules.push(schedule);
      }
    }
  }

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "SCHEDULE_SYNCED_WITH_CLINIC",
      resource: "Schedule",
      details: {
        doctorId,
        clinicId: clinic._id,
        syncedDays: updatedSchedules.map((s) => s.dayOfWeek),
      },
    });
  }

  return updatedSchedules;
};

module.exports = {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deactivateSchedule,
  syncDoctorScheduleWithClinic,
};