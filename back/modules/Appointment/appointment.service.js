const Appointment = require("./appointment.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");
const Schedule = require("../Schedule/schedule.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const {
  getSort,
  applyCairoDateRange,
  applyDoctorScope,
} = require("../../utils/listQuery");

const CLINIC_TIMEZONE = "Africa/Cairo";

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};

const getClinicDateParts = (date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(new Date(date));

  return Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value])
  );
};

const getDayOfWeek = (date) => {
  const { weekday } = getClinicDateParts(date);

  const days = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return days[weekday];
};

const getTimeInMinutes = (date) => {
  const { hour, minute } = getClinicDateParts(date);

  return Number(hour) * 60 + Number(minute);
};

const validatePatient = async (patientId) => {
  const patient = await Patient.findById(patientId);

  if (!patient) {
    throw new AppError(
      "Patient not found",
      404,
      "PATIENT_NOT_FOUND"
    );
  }

  if (!patient.isActive) {
    throw new AppError(
      "Patient is inactive",
      400,
      "PATIENT_INACTIVE"
    );
  }

  return patient;
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

const getDoctorSchedule = async (doctorId, appointmentDate) => {
  const dayOfWeek = getDayOfWeek(appointmentDate);

  const schedule = await Schedule.findOne({
    doctor: doctorId,
    dayOfWeek,
    isActive: true,
  });

  if (!schedule) {
    throw new AppError(
      "Doctor is not available on this day",
      400,
      "DOCTOR_NOT_AVAILABLE"
    );
  }

  return schedule;
};

const validateAppointmentTime = (appointmentDate, duration, schedule) => {
  const appointmentMinutes = getTimeInMinutes(appointmentDate);
  const appointmentEndMinutes = appointmentMinutes + duration;
  const scheduleStart = timeToMinutes(schedule.startTime);
  const scheduleEnd = timeToMinutes(schedule.endTime);

  if (appointmentMinutes < scheduleStart || appointmentEndMinutes > scheduleEnd) {
    throw new AppError(
      "Appointment is outside doctor's working hours",
      400,
      "APPOINTMENT_OUTSIDE_WORKING_HOURS"
    );
  }

  if (schedule.breakStart && schedule.breakEnd) {
    const breakStart = timeToMinutes(schedule.breakStart);
    const breakEnd = timeToMinutes(schedule.breakEnd);
    const overlapsBreak = appointmentMinutes < breakEnd && appointmentEndMinutes > breakStart;

    if (overlapsBreak) {
      throw new AppError(
        "Appointment overlaps doctor's break time",
        400,
        "APPOINTMENT_OVERLAPS_BREAK"
      );
    }
  }
};

const validateNoConflict = async ({
  doctorId,
  appointmentDate,
  duration,
  excludeAppointmentId = null,
}) => {
  const appointmentStart = new Date(appointmentDate);
  const appointmentEnd = new Date(
    appointmentStart.getTime() + duration * 60 * 1000
  );

  const query = {
    doctor: doctorId,
    status: { $nin: ["cancelled", "no-show"] },
    appointmentDate: { $lt: appointmentEnd },
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const existingAppointments = await Appointment.find(query);

  const hasConflict = existingAppointments.some((existing) => {
    const existingStart = new Date(existing.appointmentDate);
    const existingEnd = new Date(
      existingStart.getTime() + existing.duration * 60 * 1000
    );

    return appointmentStart < existingEnd && appointmentEnd > existingStart;
  });

  if (hasConflict) {
    throw new AppError(
      "Doctor already has an appointment during this time",
      409,
      "APPOINTMENT_CONFLICT"
    );
  }
};

const createAppointment = async (data, currentUser) => {
  const { patient, doctor, appointmentDate, duration } = data;

  await validatePatient(patient);
  await validateDoctor(doctor);

  const appointment = new Date(appointmentDate);

  if (appointment <= new Date()) {
    throw new AppError(
      "Appointment date must be in the future",
      400,
      "INVALID_APPOINTMENT_DATE"
    );
  }

  const schedule = await getDoctorSchedule(doctor, appointmentDate);

  validateAppointmentTime(appointmentDate, duration, schedule);

  await validateNoConflict({ doctorId: doctor, appointmentDate, duration });

  const newAppointment = await Appointment.create({
    ...data,
    createdBy: currentUser._id,
  });

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "APPOINTMENT_CREATED",
      resource: "Appointment",
      resourceId: newAppointment._id,
      details: {
        patient: newAppointment.patient,
        doctor: newAppointment.doctor,
        appointmentDate: newAppointment.appointmentDate,
        duration: newAppointment.duration,
        status: newAppointment.status,
        reason: newAppointment.reason,
      },
    });
  }

  return newAppointment;
};

const getAppointments = async (query = {}, currentUser = null) => {
  const filter = {};

  if (query.doctor) filter.doctor = query.doctor;
  if (query.patient) filter.patient = query.patient;
  if (query.status) filter.status = query.status;

  applyCairoDateRange(filter, "appointmentDate", query);
  await applyDoctorScope(filter, query, currentUser, Doctor);

  return paginateQuery(
    Appointment.find(filter)
      .populate("patient", "firstName lastName phone email dateOfBirth gender")
      .populate({
        path: "doctor",
        select: "user specialization licenseNumber consultationFee profilePhoto",
        populate: {
          path: "user",
          select: "firstName lastName email phone",
        },
      })
      .sort(
        getSort(
          query,
          ["appointmentDate", "status", "createdAt", "updatedAt"],
          "appointmentDate",
          "asc"
        )
      ),
    Appointment.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getAppointmentById = async (id) => {
  return await Appointment.findById(id)
    .populate("patient", "firstName lastName phone email dateOfBirth gender")
    .populate({
      path: "doctor",
      select: "user specialization licenseNumber consultationFee profilePhoto",
      populate: {
        path: "user",
        select: "firstName lastName email phone",
      },
    });
};

const updateAppointment = async (id, data, currentUser) => {
  const appointment = await Appointment.findById(id);

  if (!appointment) {
    return null;
  }

  const previousValues = {
    patient: appointment.patient,
    doctor: appointment.doctor,
    appointmentDate: appointment.appointmentDate,
    duration: appointment.duration,
    status: appointment.status,
    reason: appointment.reason,
    notes: appointment.notes,
  };

  const newDate = data.appointmentDate || appointment.appointmentDate;
  const newDuration = data.duration || appointment.duration;
  const newStatus = data.status || appointment.status;

  if (
    ["completed", "cancelled"].includes(appointment.status) &&
    data.status &&
    data.status !== appointment.status
  ) {
    throw new AppError(
      `Cannot change status of a ${appointment.status} appointment`,
      400,
      "INVALID_STATUS_TRANSITION"
    );
  }

  if (newStatus === "cancelled" && !data.cancellationReason && !appointment.cancellationReason) {
    throw new AppError(
      "Cancellation reason is required",
      400,
      "CANCELLATION_REASON_REQUIRED"
    );
  }

  const isRescheduled =
    data.appointmentDate &&
    new Date(data.appointmentDate).getTime() !==
      new Date(previousValues.appointmentDate).getTime();

  if (data.appointmentDate || data.duration) {
    const appointmentDate = new Date(newDate);

    if (appointmentDate <= new Date()) {
      throw new AppError(
        "Appointment date must be in the future",
        400,
        "INVALID_APPOINTMENT_DATE"
      );
    }

    const schedule = await getDoctorSchedule(appointment.doctor, newDate);

    validateAppointmentTime(newDate, newDuration, schedule);

    await validateNoConflict({
      doctorId: appointment.doctor,
      appointmentDate: newDate,
      duration: newDuration,
      excludeAppointmentId: id,
    });
  }

  Object.assign(appointment, data);
  appointment.updatedBy = currentUser._id;

  await appointment.save();

  const newValues = {
    patient: appointment.patient,
    doctor: appointment.doctor,
    appointmentDate: appointment.appointmentDate,
    duration: appointment.duration,
    status: appointment.status,
    reason: appointment.reason,
    notes: appointment.notes,
  };

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: isRescheduled ? "APPOINTMENT_RESCHEDULED" : "APPOINTMENT_UPDATED",
      resource: "Appointment",
      resourceId: appointment._id,
      details: {
        previousValues,
        newValues,
        isRescheduled,
      },
    });
  }

  return appointment;
};

const cancelAppointment = async (id, cancellationReason, currentUser) => {
  const appointment = await Appointment.findById(id);

  if (!appointment) {
    return null;
  }

  if (appointment.status === "completed") {
    throw new AppError(
      "Completed appointment cannot be cancelled",
      400,
      "INVALID_APPOINTMENT_STATUS"
    );
  }

  if (appointment.status === "cancelled") {
    throw new AppError(
      "Appointment is already cancelled",
      400,
      "APPOINTMENT_ALREADY_CANCELLED"
    );
  }

  const previousStatus = appointment.status;

  appointment.status = "cancelled";
  appointment.cancellationReason = cancellationReason;
  appointment.updatedBy = currentUser._id;

  await appointment.save();

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "APPOINTMENT_CANCELLED",
      resource: "Appointment",
      resourceId: appointment._id,
      details: {
        previousStatus,
        newStatus: "cancelled",
        cancellationReason,
      },
    });
  }

  return appointment;
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
};
