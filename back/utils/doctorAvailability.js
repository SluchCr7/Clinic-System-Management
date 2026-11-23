const Appointment = require("../modules/Appointment/appointment.model");
const Visit = require("../modules/Visit/visit.model");
const Schedule = require("../modules/Schedule/schedule.model");
const Doctor = require("../modules/Doctor/doctor.model");
const Patient = require("../modules/Patient/patient.model");
const { AppError } = require("../middlewares/errorHandler");

const CLINIC_TIMEZONE = "Africa/Cairo";
const ACTIVE_APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "checked_in",
  "in_progress",
];

const timeToMinutes = (time) => {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const getClinicParts = (date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(date));

  return Object.fromEntries(
    parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value])
  );
};

const overlap = (startA, endA, startB, endB) =>
  startA < endB && endA > startB;

const getPatientDisplay = (patient) =>
  patient
    ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "مريض"
    : "مريض";

const getScheduleConflicts = (schedule, start, end) => {
  if (!schedule) {
    return [{ type: "OUT_OF_HOURS", id: null, start, end, patientDisplay: "خارج ساعات العمل" }];
  }

  const parts = getClinicParts(start);
  const startMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const endMinutes = startMinutes + Math.round((end - start) / 60000);
  const scheduleStart = timeToMinutes(schedule.startTime);
  const scheduleEnd = timeToMinutes(schedule.endTime);

  if (
    startMinutes < scheduleStart ||
    (
      endMinutes > scheduleEnd &&
      !(scheduleEnd >= 23 * 60 + 30 && endMinutes <= 24 * 60)
    )
  ) {
    return [{ type: "OUT_OF_HOURS", id: schedule._id, start, end, patientDisplay: "خارج ساعات العمل" }];
  }

  if (schedule.breakStart && schedule.breakEnd) {
    const breakStart = timeToMinutes(schedule.breakStart);
    const breakEnd = timeToMinutes(schedule.breakEnd);
    if (startMinutes < breakEnd && endMinutes > breakStart) {
      return [{ type: "BREAK", id: schedule._id, start, end, patientDisplay: "وقت الراحة" }];
    }
  }

  return [];
};

const getDayOfWeek = (date) => {
  const weekday = getClinicParts(date).weekday;
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday] ?? 0;
};

const getClinicOffsetMinutes = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIMEZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(date));
  const tzName = parts.find(({ type }) => type === "timeZoneName")?.value || "GMT+2";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 120;
  return (match[1] === "-" ? -1 : 1) *
    (Number(match[2] || 0) * 60 + Number(match[3] || 0));
};

const clinicWallTimeToUtc = (datePart, timePart) => {
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const localAsUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Date(localAsUtc.getTime() - getClinicOffsetMinutes(localAsUtc) * 60 * 1000);
};

const getNextAvailableSlots = async ({
  doctorId,
  date,
  duration,
  patientId = null,
  excludeAppointmentId = null,
  excludeVisitId = null,
  session = null,
}) => {
  const baseDate = new Date(date);
  const datePart = `${baseDate.getUTCFullYear()}-${String(baseDate.getUTCMonth() + 1).padStart(2, "0")}-${String(baseDate.getUTCDate()).padStart(2, "0")}`;

  const slots = [];
  for (let minute = 8 * 60; minute < 20 * 60 && slots.length < 3; minute += duration) {
    const timePart =
      `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const candidateStart = clinicWallTimeToUtc(datePart, timePart);
    const candidateEnd = new Date(candidateStart.getTime() + duration * 60 * 1000);
    const result = await checkDoctorAvailability({
      doctorId,
      patientId,
      start: candidateStart,
      end: candidateEnd,
      excludeAppointmentId,
      excludeVisitId,
      session,
      includeNextSlots: false,
    });
    if (result.available) {
      slots.push({ start: candidateStart, end: candidateEnd });
    }
  }
  return slots;
};

const checkDoctorAvailability = async ({
  doctorId,
  patientId = null,
  start,
  end,
  excludeAppointmentId = null,
  excludeVisitId = null,
  session = null,
  includeNextSlots = true,
  checkWorkingHours = true,
}) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (!(startDate instanceof Date) || isNaN(startDate) || !(endDate instanceof Date) || isNaN(endDate) || endDate <= startDate) {
    throw new AppError("Start and end times must be valid", 400, "INVALID_APPOINTMENT_TIME");
  }

  const doctor = await Doctor.findById(doctorId).select("_id isActive").session(session);
  if (!doctor || !doctor.isActive) {
    throw new AppError("Doctor is unavailable", 404, "DOCTOR_NOT_FOUND");
  }

  const dayOfWeek = getDayOfWeek(startDate);
  const schedule = checkWorkingHours
    ? await Schedule.findOne({
        doctor: doctorId,
        dayOfWeek,
        isActive: true,
      }).session(session)
    : null;

  const conflicts = checkWorkingHours
    ? getScheduleConflicts(schedule, startDate, endDate)
    : [];

  const appointmentQuery = {
    doctor: doctorId,
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    appointmentDate: { $lt: endDate },
  };
  if (excludeAppointmentId) appointmentQuery._id = { $ne: excludeAppointmentId };

  const appointments = await Appointment.find(appointmentQuery)
    .populate("patient", "firstName lastName")
    .session(session);

  for (const appointment of appointments) {
    const appointmentStart = new Date(appointment.appointmentDate);
    const appointmentEnd = new Date(
      appointmentStart.getTime() + (appointment.duration || 30) * 60 * 1000
    );
    if (overlap(startDate, endDate, appointmentStart, appointmentEnd)) {
      conflicts.push({
        type: "APPOINTMENT",
        id: appointment._id,
        start: appointmentStart,
        end: appointmentEnd,
        patientDisplay: getPatientDisplay(appointment.patient),
      });
    }
  }

  const visitQuery = {
    doctor: doctorId,
    status: "in_progress",
  };
  if (excludeVisitId) visitQuery._id = { $ne: excludeVisitId };

  const visits = await Visit.find(visitQuery)
    .populate("patient", "firstName lastName")
    .populate("appointment", "appointmentDate duration")
    .session(session);

  for (const visit of visits) {
    const visitStart = new Date(visit.startedAt || visit.createdAt);
    const linkedAppointment = visit.appointment;
    const expectedEnd =
      linkedAppointment?.appointmentDate
        ? new Date(
            new Date(linkedAppointment.appointmentDate).getTime() +
              (linkedAppointment.duration || 30) * 60 * 1000
          )
        : new Date(visitStart.getTime() + 30 * 60 * 1000);
    const visitEnd = new Date(Math.max(expectedEnd.getTime(), Date.now()));
    if (overlap(startDate, endDate, visitStart, visitEnd)) {
      conflicts.push({
        type: "VISIT",
        id: visit._id,
        start: visitStart,
        end: visitEnd,
        patientDisplay: getPatientDisplay(visit.patient),
      });
    }
  }

  if (patientId) {
    const patientAppointments = await Appointment.find({
      patient: patientId,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      appointmentDate: { $lt: endDate },
    }).session(session);

    for (const appointment of patientAppointments) {
      if (excludeAppointmentId && appointment._id.toString() === excludeAppointmentId.toString()) continue;
      const appointmentStart = new Date(appointment.appointmentDate);
      const appointmentEnd = new Date(
        appointmentStart.getTime() + (appointment.duration || 30) * 60 * 1000
      );
      if (overlap(startDate, endDate, appointmentStart, appointmentEnd)) {
        conflicts.push({
          type: "PATIENT_APPOINTMENT",
          id: appointment._id,
          start: appointmentStart,
          end: appointmentEnd,
          patientDisplay: "المريض نفسه",
        });
      }
    }

    const patientVisits = await Visit.find({
      patient: patientId,
      status: "in_progress",
    })
      .populate("appointment", "appointmentDate duration")
      .session(session);

    for (const visit of patientVisits) {
      if (excludeVisitId && visit._id.toString() === excludeVisitId.toString()) continue;
      const visitStart = new Date(visit.startedAt || visit.createdAt);
      const linkedAppointment = visit.appointment;
      const expectedEnd =
        linkedAppointment?.appointmentDate
          ? new Date(
              new Date(linkedAppointment.appointmentDate).getTime() +
                (linkedAppointment.duration || 30) * 60 * 1000
            )
          : new Date(visitStart.getTime() + 30 * 60 * 1000);
      const visitEnd = new Date(Math.max(expectedEnd.getTime(), Date.now()));
      if (overlap(startDate, endDate, visitStart, visitEnd)) {
        conflicts.push({
          type: "PATIENT_VISIT",
          id: visit._id,
          start: visitStart,
          end: visitEnd,
          patientDisplay: "المريض نفسه",
        });
      }
    }
  }

  const uniqueConflicts = conflicts.filter(
    (conflict, index, list) =>
      list.findIndex(
        (candidate) =>
          candidate.type === conflict.type &&
          candidate.id?.toString() === conflict.id?.toString()
      ) === index
  );

  const nextAvailableSlots = includeNextSlots && uniqueConflicts.length
    ? await getNextAvailableSlots({
        doctorId,
        date: startDate,
        duration: Math.round((endDate - startDate) / 60000),
        patientId,
        excludeAppointmentId,
        excludeVisitId,
        session,
      })
    : [];

  return {
    available: uniqueConflicts.length === 0,
    conflicts: uniqueConflicts,
    nextAvailableSlots,
  };
};

const throwAvailabilityConflict = (availability) => {
  if (availability.available) return;
  const hasVisit = availability.conflicts.some(({ type }) => type === "VISIT");
  const hasPatientConflict = availability.conflicts.some(({ type }) =>
    type.startsWith("PATIENT_")
  );
  const outOfHours = availability.conflicts.some(({ type }) =>
    ["OUT_OF_HOURS", "BREAK"].includes(type)
  );

  let code = "DOCTOR_BUSY";
  let message = "Doctor is busy during this time";
  if (hasVisit) {
    code = "DOCTOR_BUSY";
    message = "Doctor is in a current visit during this time";
  } else if (availability.conflicts.some(({ type }) => type === "APPOINTMENT")) {
    code = "APPOINTMENT_CONFLICT";
    message = "Doctor already has an appointment during this time";
  } else if (hasPatientConflict) {
    code = "PATIENT_DOUBLE_BOOKED";
    message = "The patient is already booked or is in a visit during this time";
  } else if (outOfHours) {
    code = "OUTSIDE_WORKING_HOURS";
    message = "Appointment is outside working hours";
  } else if (hasVisit) {
    code = "DOCTOR_BUSY";
    message = "Doctor is in a current visit during this time";
  }

  throw new AppError(message, 409, code, {
    conflicts: availability.conflicts,
    nextAvailableSlots: availability.nextAvailableSlots,
  });
};

module.exports = {
  checkDoctorAvailability,
  throwAvailabilityConflict,
  getNextAvailableSlots,
};
