// const mongoose = require("mongoose");
// const Appointment = require("./appointment.model");
// const Patient = require("../Patient/patient.model");
// const Doctor = require("../Doctor/doctor.model");
// const Schedule = require("../Schedule/schedule.model");
// const { AppError } = require("../../middlewares/errorHandler");
// const auditLogService = require("../AuditLog/auditLog.service");
// const { paginateQuery } = require("../../utils/pagination");
// const {
//   getSort,
//   applyCairoDateRange,
//   applyDoctorScope,
//   getDoctorScopeId,
// } = require("../../utils/listQuery");

// const CLINIC_TIMEZONE = "Africa/Cairo";

// const timeToMinutes = (time) => {
//   const [hours, minutes] = time.split(":").map(Number);

//   return hours * 60 + minutes;
// };

// const getClinicOffsetMinutes = (date = new Date()) => {
//   const formatter = new Intl.DateTimeFormat("en-US", {
//     timeZone: CLINIC_TIMEZONE,
//     timeZoneName: "shortOffset",
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//     hour: "2-digit",
//     minute: "2-digit",
//     second: "2-digit",
//     hourCycle: "h23",
//   });

//   const parts = formatter.formatToParts(date);
//   const tzName = parts.find(({ type }) => type === "timeZoneName")?.value || "GMT+2";
//   const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);

//   if (!match) {
//     return 120;
//   }

//   const sign = match[1] === "-" ? -1 : 1;
//   const hours = Number(match[2] || 0);
//   const minutes = Number(match[3] || 0);

//   return sign * (hours * 60 + minutes);
// };

// const normalizeClinicDate = (date) => {
//   if (date instanceof Date) {
//     return date;
//   }

//   if (typeof date !== "string") {
//     return new Date(date);
//   }

//   const value = date.trim();

//   if (!value) {
//     return new Date(NaN);
//   }

//   if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) {
//     const [datePart, timePart] = value.split("T");
//     const [year, month, day] = datePart.split("-").map(Number);
//     const [hour, minute, second = 0, millisecond = 0] = timePart
//       .split(":")
//       .map((part) => Number(part.split(".")[0] || part));
//     const utcTimestamp = Date.UTC(
//       year,
//       month - 1,
//       day,
//       hour,
//       minute,
//       second,
//       millisecond
//     );
//     const offsetMinutes = getClinicOffsetMinutes(new Date(utcTimestamp));

//     return new Date(utcTimestamp - offsetMinutes * 60 * 1000);
//   }

//   return new Date(value);
// };

// const getClinicDateParts = (date) => {
//   const formatter = new Intl.DateTimeFormat("en-US", {
//     timeZone: CLINIC_TIMEZONE,
//     weekday: "short",
//     hour: "2-digit",
//     minute: "2-digit",
//     hourCycle: "h23",
//   });

//   const parts = formatter.formatToParts(normalizeClinicDate(date));

//   return Object.fromEntries(
//     parts
//       .filter(({ type }) => type !== "literal")
//       .map(({ type, value }) => [type, value])
//   );
// };

// const getDayOfWeek = (date) => {
//   const { weekday } = getClinicDateParts(date);

//   const days = {
//     Sun: 0,
//     Mon: 1,
//     Tue: 2,
//     Wed: 3,
//     Thu: 4,
//     Fri: 5,
//     Sat: 6,
//   };

//   return days[weekday];
// };

// const getTimeInMinutes = (date) => {
//   const { hour, minute } = getClinicDateParts(date);

//   return Number(hour) * 60 + Number(minute);
// };

// const toClinicDate = (date) => normalizeClinicDate(date);

// const validatePatient = async (patientId) => {
//   const patient = await Patient.findById(patientId);

//   if (!patient) {
//     throw new AppError(
//       "Patient not found",
//       404,
//       "PATIENT_NOT_FOUND"
//     );
//   }

//   if (!patient.isActive) {
//     throw new AppError(
//       "Patient is inactive",
//       400,
//       "PATIENT_INACTIVE"
//     );
//   }

//   return patient;
// };

// const validateDoctor = async (doctorId) => {
//   const doctor = await Doctor.findById(doctorId);

//   if (!doctor) {
//     throw new AppError(
//       "Doctor not found",
//       404,
//       "DOCTOR_NOT_FOUND"
//     );
//   }

//   if (!doctor.isActive) {
//     throw new AppError(
//       "Doctor is inactive",
//       400,
//       "DOCTOR_INACTIVE"
//     );
//   }

//   return doctor;
// };

// const getDoctorSchedule = async (doctorId, appointmentDate) => {
//   const dayOfWeek = getDayOfWeek(appointmentDate);

//   const schedule = await Schedule.findOne({
//     doctor: doctorId,
//     dayOfWeek,
//     isActive: true,
//   });

//   if (!schedule) {
//     throw new AppError(
//       "Doctor is not available on this day",
//       400,
//       "DOCTOR_NOT_AVAILABLE"
//     );
//   }

//   return schedule;
// };

// const validateAppointmentTime = (appointmentDate, duration, schedule) => {
//   const appointmentMinutes = getTimeInMinutes(appointmentDate);
//   const appointmentEndMinutes = appointmentMinutes + duration;
//   const scheduleStart = timeToMinutes(schedule.startTime);
//   const scheduleEnd = timeToMinutes(schedule.endTime);

//   if (appointmentMinutes < scheduleStart || appointmentEndMinutes > scheduleEnd) {
//     throw new AppError(
//       "Appointment is outside doctor's working hours",
//       400,
//       "APPOINTMENT_OUTSIDE_WORKING_HOURS"
//     );
//   }

//   if (schedule.breakStart && schedule.breakEnd) {
//     const breakStart = timeToMinutes(schedule.breakStart);
//     const breakEnd = timeToMinutes(schedule.breakEnd);
//     const overlapsBreak = appointmentMinutes < breakEnd && appointmentEndMinutes > breakStart;

//     if (overlapsBreak) {
//       throw new AppError(
//         "Appointment overlaps doctor's break time",
//         400,
//         "APPOINTMENT_OVERLAPS_BREAK"
//       );
//     }
//   }
// };

// const validateNoConflict = async ({
//   doctorId,
//   appointmentDate,
//   duration,
//   excludeAppointmentId = null,
//   session = null,
// }) => {
//   const appointmentStart = toClinicDate(appointmentDate);
//   const appointmentEnd = new Date(
//     appointmentStart.getTime() + duration * 60 * 1000
//   );

//   const query = {
//     doctor: doctorId,
//     status: { $nin: ["cancelled", "no-show"] },
//     appointmentDate: { $lt: appointmentEnd },
//   };

//   if (excludeAppointmentId) {
//     query._id = { $ne: excludeAppointmentId };
//   }

//   const existingAppointments = await Appointment.find(query).session(session);

//   const hasConflict = existingAppointments.some((existing) => {
//     const existingStart = new Date(existing.appointmentDate);
//     const existingEnd = new Date(
//       existingStart.getTime() + existing.duration * 60 * 1000
//     );

//     return appointmentStart < existingEnd && appointmentEnd > existingStart;
//   });

//   if (hasConflict) {
//     throw new AppError(
//       "Doctor already has an appointment during this time",
//       409,
//       "APPOINTMENT_CONFLICT"
//     );
//   }
// };

// const createAppointment = async (data, currentUser) => {
//   const { patient, doctor, appointmentDate, duration } = data;

//   await validatePatient(patient);
//   await validateDoctor(doctor);

//   const appointment = toClinicDate(appointmentDate);

//   if (appointment <= new Date()) {
//     throw new AppError(
//       "Appointment date must be in the future",
//       400,
//       "INVALID_APPOINTMENT_DATE"
//     );
//   }

//   const schedule = await getDoctorSchedule(doctor, appointmentDate);

//   validateAppointmentTime(appointmentDate, duration, schedule);

//   const session = await mongoose.startSession();
//   try {
//     session.startTransaction();

//     await validateNoConflict({
//       doctorId: doctor,
//       appointmentDate,
//       duration,
//       session,
//     });

//     const [newAppointment] = await Appointment.create(
//       [
//         {
//           ...data,
//           createdBy: currentUser._id,
//         },
//       ],
//       { session }
//     );

//     if (currentUser?._id) {
//       await auditLogService.logActivity({
//         actor: currentUser,
//         action: "APPOINTMENT_CREATED",
//         resource: "Appointment",
//         resourceId: newAppointment._id,
//         details: {
//           patient: newAppointment.patient,
//           doctor: newAppointment.doctor,
//           appointmentDate: newAppointment.appointmentDate,
//           duration: newAppointment.duration,
//           status: newAppointment.status,
//           reason: newAppointment.reason,
//         },
//         session,
//       });
//     }

//     await session.commitTransaction();
//     return newAppointment;
//   } catch (error) {
//     await session.abortTransaction();
//     throw error;
//   } finally {
//     session.endSession();
//   }
// };

// const getAppointments = async (query = {}, currentUser = null) => {
//   const filter = {};

//   if (query.doctor) filter.doctor = query.doctor;
//   if (query.patient) filter.patient = query.patient;
//   if (query.status) filter.status = query.status;

//   applyCairoDateRange(filter, "appointmentDate", query);
//   await applyDoctorScope(filter, query, currentUser, Doctor);

//   return paginateQuery(
//     Appointment.find(filter)
//       .populate("patient", "firstName lastName phone email dateOfBirth gender")
//       .populate({
//         path: "doctor",
//         select: "user specialization licenseNumber consultationFee profilePhoto",
//         populate: {
//           path: "user",
//           select: "firstName lastName email phone",
//         },
//       })
//       .sort(
//         getSort(
//           query,
//           ["appointmentDate", "status", "createdAt", "updatedAt"],
//           "appointmentDate",
//           "asc"
//         )
//       ),
//     Appointment.countDocuments(filter),
//     query.page,
//     query.limit
//   );
// };

// const getAppointmentById = async (id, currentUser = null) => {
//   const filter = { _id: id };
//   if (currentUser?.role === "doctor") {
//     const doctorId = await getDoctorScopeId(currentUser, Doctor);
//     if (!doctorId) return null;
//     filter.doctor = doctorId;
//   }

//   return await Appointment.findOne(filter)
//     .populate("patient", "firstName lastName phone email dateOfBirth gender")
//     .populate({
//       path: "doctor",
//       select: "user specialization licenseNumber consultationFee profilePhoto",
//       populate: {
//         path: "user",
//         select: "firstName lastName email phone",
//       },
//     });
// };

// const updateAppointment = async (id, data, currentUser) => {
//   const appointment = await Appointment.findById(id);

//   if (!appointment) {
//     return null;
//   }

//   const previousValues = {
//     patient: appointment.patient,
//     doctor: appointment.doctor,
//     appointmentDate: appointment.appointmentDate,
//     duration: appointment.duration,
//     status: appointment.status,
//     reason: appointment.reason,
//     notes: appointment.notes,
//   };

//   const newDate = data.appointmentDate || appointment.appointmentDate;
//   const newDuration = data.duration || appointment.duration;
//   const newStatus = data.status || appointment.status;

//   if (currentUser?.role === "doctor") {
//     const doctorId = await getDoctorScopeId(currentUser, Doctor);
//     if (!doctorId || appointment.doctor.toString() !== doctorId.toString()) {
//       throw new AppError(
//         "You are not authorized to update another doctor's appointment",
//         403,
//         "FORBIDDEN"
//       );
//     }
//   }

//   const allowedTransitions = {
//     scheduled: ["confirmed", "checked_in", "cancelled", "no-show"],
//     confirmed: ["checked_in", "in_progress", "cancelled", "no-show"],
//     checked_in: ["in_progress", "cancelled", "no-show"],
//     in_progress: ["completed", "cancelled"],
//     completed: [],
//     cancelled: [],
//     "no-show": [],
//   };

//   const roleAllowedTransitions = {
//     admin: ["confirmed", "checked_in", "in_progress", "completed", "cancelled", "no-show"],
//     receptionist: ["confirmed", "checked_in", "cancelled", "no-show"],
//     doctor: ["in_progress", "completed", "cancelled"],
//   };

//   if (data.status && data.status !== appointment.status) {
//     const validNextStates = allowedTransitions[appointment.status] || [];
//     if (!validNextStates.includes(data.status)) {
//       throw new AppError(
//         `Cannot transition appointment from '${appointment.status}' to '${data.status}'`,
//         400,
//         "INVALID_STATUS_TRANSITION"
//       );
//     }

//     const roleAllowed = roleAllowedTransitions[currentUser?.role] || [];
//     if (!roleAllowed.includes(data.status)) {
//       throw new AppError(
//         `Role '${currentUser?.role}' is not authorized to transition appointment to '${data.status}'`,
//         403,
//         "FORBIDDEN"
//       );
//     }
//   }

//   if (newStatus === "cancelled" && !data.cancellationReason && !appointment.cancellationReason) {
//     throw new AppError(
//       "Cancellation reason is required",
//       400,
//       "CANCELLATION_REASON_REQUIRED"
//     );
//   }

//   const isRescheduled =
//     Boolean(data.appointmentDate) &&
//     toClinicDate(data.appointmentDate).getTime() !==
//       toClinicDate(previousValues.appointmentDate).getTime();

//   const isDurationChanged =
//     data.duration !== undefined &&
//     data.duration !== previousValues.duration;

//   if (isRescheduled || isDurationChanged) {
//     const appointmentDate = toClinicDate(newDate);

//     if (appointmentDate <= new Date()) {
//       throw new AppError(
//         "Appointment date must be in the future",
//         400,
//         "INVALID_APPOINTMENT_DATE"
//       );
//     }

//     const schedule = await getDoctorSchedule(appointment.doctor, newDate);

//     validateAppointmentTime(newDate, newDuration, schedule);

//     await validateNoConflict({
//       doctorId: appointment.doctor,
//       appointmentDate: newDate,
//       duration: newDuration,
//       excludeAppointmentId: id,
//     });
//   }

//   const allowedFields = [
//     "appointmentDate",
//     "duration",
//     "status",
//     "reason",
//     "notes",
//     "cancellationReason",
//   ];

//   for (const field of allowedFields) {
//     if (data[field] !== undefined) {
//       appointment[field] = data[field];
//     }
//   }

//   if (isRescheduled) {
//     appointment.reminderSent = false;
//   }
//   appointment.updatedBy = currentUser._id;

//   await appointment.save();

//   const newValues = {
//     patient: appointment.patient,
//     doctor: appointment.doctor,
//     appointmentDate: appointment.appointmentDate,
//     duration: appointment.duration,
//     status: appointment.status,
//     reason: appointment.reason,
//     notes: appointment.notes,
//   };

//   if (currentUser?._id) {
//     await auditLogService.logActivity({
//       actor: currentUser,
//       action: isRescheduled ? "APPOINTMENT_RESCHEDULED" : "APPOINTMENT_UPDATED",
//       resource: "Appointment",
//       resourceId: appointment._id,
//       details: {
//         previousValues,
//         newValues,
//         isRescheduled,
//       },
//     });
//   }

//   return appointment;
// };

// const cancelAppointment = async (id, cancellationReason, currentUser) => {
//   const appointment = await Appointment.findById(id);

//   if (!appointment) {
//     return null;
//   }

//   if (appointment.status === "completed") {
//     throw new AppError(
//       "Completed appointment cannot be cancelled",
//       400,
//       "INVALID_APPOINTMENT_STATUS"
//     );
//   }

//   if (appointment.status === "cancelled") {
//     throw new AppError(
//       "Appointment is already cancelled",
//       400,
//       "APPOINTMENT_ALREADY_CANCELLED"
//     );
//   }

//   const previousStatus = appointment.status;

//   appointment.status = "cancelled";
//   appointment.cancellationReason = cancellationReason;
//   appointment.updatedBy = currentUser._id;

//   await appointment.save();

//   if (currentUser?._id) {
//     await auditLogService.logActivity({
//       actor: currentUser,
//       action: "APPOINTMENT_CANCELLED",
//       resource: "Appointment",
//       resourceId: appointment._id,
//       details: {
//         previousStatus,
//         newStatus: "cancelled",
//         cancellationReason,
//       },
//     });
//   }

//   return appointment;
// };

// module.exports = {
//   createAppointment,
//   getAppointments,
//   getAppointmentById,
//   updateAppointment,
//   cancelAppointment,
// };


const mongoose = require("mongoose");
const Appointment = require("./appointment.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");
const Schedule = require("../Schedule/schedule.model");
const Visit = require("../Visit/visit.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const {
  getSort,
  applyCairoDateRange,
  applyDoctorScope,
  getDoctorScopeId,
} = require("../../utils/listQuery");

const CLINIC_TIMEZONE = "Africa/Cairo";

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
};

const getClinicOffsetMinutes = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const tzName =
    parts.find(({ type }) => type === "timeZoneName")?.value || "GMT+2";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);

  if (!match) {
    return 120;
    }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);

  return sign * (hours * 60 + minutes);
};

const normalizeClinicDate = (date) => {
  if (date instanceof Date) {
    return date;
    }

  if (typeof date !== "string") {
    return new Date(date);
    }

  const value = date.trim();

  if (!value) {
    return new Date(NaN);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)) {
    const [datePart, timePart] = value.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute, second = 0, millisecond = 0] = timePart
      .split(":")
      .map((part) => Number(part.split(".")[0] || 0));
    const utcTimestamp = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
      millisecond
    );
    const offsetMinutes = getClinicOffsetMinutes(new Date(utcTimestamp));

    return new Date(utcTimestamp - offsetMinutes * 60 * 1000);
  }

  return new Date(value);
};

const getClinicDateParts = (date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(normalizeClinicDate(date));

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

  return days[weekday] ?? 0;
};

const getTimeInMinutes = (date) => {
  const { hour, minute } = getClinicDateParts(date);

  return Number(hour) * 60 + Number(minute);
};

const toClinicDate = (date) => normalizeClinicDate(date);

const validatePatient = async (patientId, session = null) => {
  const patient = await Patient.findById(patientId).session(session);

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

const validateDoctor = async (doctorId, session = null) => {
  const doctor = await Doctor.findById(doctorId).session(session);

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

const getDoctorSchedule = async (doctorId, appointmentDate, session = null) => {
  const dayOfWeek = getDayOfWeek(appointmentDate);

  const schedule = await Schedule.findOne({
    doctor: doctorId,
    dayOfWeek,
    isActive: true,
  }).session(session);

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
  const isNearMidnight = scheduleEnd >= 23 * 60 + 30;
  const crossesIntoNextDay = appointmentEndMinutes > scheduleEnd;
  const withinAllowedMidnightWindow =
    isNearMidnight && appointmentEndMinutes <= 24 * 60 && appointmentMinutes >= scheduleStart;

  if (
    appointmentMinutes < scheduleStart ||
    (!withinAllowedMidnightWindow && crossesIntoNextDay)
  ) {
    throw new AppError(
      "Appointment is outside doctor's working hours",
      400,
      "APPOINTMENT_OUTSIDE_WORKING_HOURS"
    );
  }

  if (appointmentEndMinutes > 24 * 60 && appointmentMinutes >= scheduleStart) {
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
  session = null,
}) => {
  const appointmentStart = toClinicDate(appointmentDate);
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

  const existingAppointments = await Appointment.find(query).session(session);

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

const validateFollowUpDoesNotDuplicate = async ({
  originatingVisit,
  doctorId,
  patientId,
  excludeAppointmentId = null,
  session = null,
}) => {
  if (!originatingVisit) {
    return;
  }

  const query = {
    originatingVisit,
    patient: patientId,
    doctor: doctorId,
    status: { $nin: ["cancelled", "no-show"] },
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const existingFollowUp = await Appointment.findOne(query).session(session);

  if (existingFollowUp) {
    throw new AppError(
      "A follow-up appointment for this visit already exists",
      409,
      "FOLLOW_UP_ALREADY_EXISTS"
    );
  }
};

const validateFollowUpReferences = async ({
  originatingVisit,
  followUpOf,
  doctorId,
  patientId,
  excludeAppointmentId = null,
  session = null,
}) => {
  if (originatingVisit) {
    const visit = await Visit.findById(originatingVisit).session(session);

    if (!visit) {
      throw new AppError("Visit not found", 404, "VISIT_NOT_FOUND");
    }

    if (
      visit.patient.toString() !== patientId.toString() ||
      visit.doctor.toString() !== doctorId.toString()
    ) {
      throw new AppError(
        "Follow-up visit must belong to the selected patient and doctor",
        400,
        "FOLLOW_UP_VISIT_MISMATCH"
      );
    }
  }

  if (followUpOf) {
    const parentAppointment = await Appointment.findById(followUpOf).session(session);

    if (!parentAppointment) {
      throw new AppError(
        "Follow-up appointment source not found",
        404,
        "FOLLOW_UP_APPOINTMENT_NOT_FOUND"
      );
    }

    if (
      parentAppointment._id.toString() === excludeAppointmentId?.toString() ||
      parentAppointment.patient.toString() !== patientId.toString() ||
      parentAppointment.doctor.toString() !== doctorId.toString()
    ) {
      throw new AppError(
        "Follow-up appointment source must belong to the selected patient and doctor",
        400,
        "FOLLOW_UP_APPOINTMENT_MISMATCH"
      );
    }
  }
};

const createAppointment = async (data, currentUser) => {
  const {
    patient,
    doctor,
    appointmentDate,
    duration,
    originatingVisit,
    followUpOf,
  } = data;
  const appointment = toClinicDate(appointmentDate);

  if (appointment <= new Date()) {
    throw new AppError(
      "Appointment date must be in the future",
      400,
      "INVALID_APPOINTMENT_DATE"
    );
  }

  return withAppointmentTransaction(async (session) => {
    await lockDoctorAppointmentBookings(doctor, session);
    await validatePatient(patient, session);
    await validateDoctor(doctor, session);

    const schedule = await getDoctorSchedule(doctor, appointmentDate, session);
    validateAppointmentTime(appointmentDate, duration, schedule);

    await validateFollowUpReferences({
      originatingVisit,
      followUpOf,
      doctorId: doctor,
      patientId: patient,
      session,
    });

    await validateNoConflict({
      doctorId: doctor,
      appointmentDate,
      duration,
      session,
    });

    await validateFollowUpDoesNotDuplicate({
      originatingVisit,
      doctorId: doctor,
      patientId: patient,
      session,
    });

    const [newAppointment] = await Appointment.create(
      [
        {
          ...data,
          createdBy: currentUser._id,
        },
      ],
      { session }
    );

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
        session,
      });
    }

    return newAppointment;
  });
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

const getAppointmentById = async (id, currentUser = null) => {
  const filter = { _id: id };
  if (currentUser?.role === "doctor") {
    const doctorId = await getDoctorScopeId(currentUser, Doctor);
    if (!doctorId) return null;
    filter.doctor = doctorId;
  }

  return await Appointment.findOne(filter)
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

const lockDoctorAppointmentBookings = async (doctorId, session) => {
  const result = await Doctor.updateOne(
    { _id: doctorId },
    { $inc: { appointmentBookingVersion: 1 } },
    { session }
  );

  if (result.matchedCount === 0) {
    throw new AppError("Doctor not found", 404, "DOCTOR_NOT_FOUND");
  }
};

const withAppointmentTransaction = async (callback) => {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const updateAppointment = async (id, data, currentUser) => {
  return withAppointmentTransaction(async (session) => {
    const appointment = await Appointment.findById(id).session(session);

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

    if (currentUser?.role === "doctor") {
      const doctorId = await getDoctorScopeId(currentUser, Doctor);
      if (!doctorId || appointment.doctor.toString() !== doctorId.toString()) {
        throw new AppError(
          "You are not authorized to update another doctor's appointment",
          403,
          "FORBIDDEN"
        );
      }
    }

    const allowedTransitions = {
      scheduled: ["confirmed", "checked_in", "cancelled", "no-show"],
      confirmed: ["checked_in", "in_progress", "cancelled", "no-show"],
      checked_in: ["in_progress", "cancelled", "no-show"],
      in_progress: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
      "no-show": [],
    };

    const roleAllowedTransitions = {
      admin: ["confirmed", "checked_in", "in_progress", "completed", "cancelled", "no-show"],
      receptionist: ["confirmed", "checked_in", "cancelled", "no-show"],
      doctor: ["in_progress", "completed", "cancelled"],
    };

    if (data.status && data.status !== appointment.status) {
      const validNextStates = allowedTransitions[appointment.status] || [];
      if (!validNextStates.includes(data.status)) {
        throw new AppError(
          `Cannot transition appointment from '${appointment.status}' to '${data.status}'`,
          400,
          "INVALID_STATUS_TRANSITION"
        );
      }

      const roleAllowed = roleAllowedTransitions[currentUser?.role] || [];
      if (!roleAllowed.includes(data.status)) {
        throw new AppError(
          `Role '${currentUser?.role}' is not authorized to transition appointment to '${data.status}'`,
          403,
          "FORBIDDEN"
        );
      }
    }

    if (
      data.status === "completed" &&
      !(await Visit.exists({ appointment: appointment._id }).session(session))
    ) {
      throw new AppError(
        "An appointment cannot be completed before its visit is recorded",
        400,
        "VISIT_REQUIRED_FOR_COMPLETION"
      );
    }

    if (
      newStatus === "cancelled" &&
      !data.cancellationReason &&
      !appointment.cancellationReason
    ) {
      throw new AppError(
        "Cancellation reason is required",
        400,
        "CANCELLATION_REASON_REQUIRED"
      );
    }

    const isRescheduled =
      Boolean(data.appointmentDate) &&
      toClinicDate(data.appointmentDate).getTime() !==
        toClinicDate(previousValues.appointmentDate).getTime();

    const isDurationChanged =
      data.duration !== undefined &&
      data.duration !== previousValues.duration;

    const followUpReferenceChanged =
      data.originatingVisit !== undefined || data.followUpOf !== undefined;

    if (isRescheduled || isDurationChanged || followUpReferenceChanged) {
      await lockDoctorAppointmentBookings(appointment.doctor, session);
    }

    if (isRescheduled || isDurationChanged) {
      const appointmentDate = toClinicDate(newDate);

      if (appointmentDate <= new Date()) {
        throw new AppError(
          "Appointment date must be in the future",
          400,
          "INVALID_APPOINTMENT_DATE"
        );
      }

      const schedule = await getDoctorSchedule(
        appointment.doctor,
        newDate,
        session
      );

      validateAppointmentTime(newDate, newDuration, schedule);

      await validateNoConflict({
        doctorId: appointment.doctor,
        appointmentDate: newDate,
        duration: newDuration,
        excludeAppointmentId: id,
        session,
      });

      await validateFollowUpDoesNotDuplicate({
        originatingVisit:
          data.originatingVisit !== undefined
            ? data.originatingVisit
            : appointment.originatingVisit,
        doctorId: appointment.doctor,
        patientId: appointment.patient,
        excludeAppointmentId: id,
        session,
      });
    }

    if (followUpReferenceChanged) {
      await validateFollowUpReferences({
        originatingVisit:
          data.originatingVisit !== undefined
            ? data.originatingVisit
            : appointment.originatingVisit,
        followUpOf:
          data.followUpOf !== undefined ? data.followUpOf : appointment.followUpOf,
        doctorId: appointment.doctor,
        patientId: appointment.patient,
        excludeAppointmentId: id,
        session,
      });
    }

    const allowedFields = [
      "appointmentDate",
      "duration",
      "status",
      "reason",
      "notes",
      "cancellationReason",
      "isFollowUp",
      "originatingVisit",
      "followUpOf",
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        appointment[field] = data[field];
      }
    }

    if (isRescheduled) {
      appointment.reminderSent = false;
    }
    appointment.updatedBy = currentUser._id;

    await appointment.save({ session });

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
        session,
      });
    }

    return appointment;
  });
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