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
} = require("../../utils/listQuery");
const {
  assertDoctorAccess,
  applyClinicScope,
  getAuthorizedDoctorIds,
} = require("../../utils/accessControl");
const {
  createInitialStatusHistory,
  transitionAppointment,
} = require("../../utils/appointmentLifecycle");

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

const validatePatient = async (patientId, session = null, doctorId = null) => {
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

  if (doctorId && patient.doctor && patient.doctor.toString() !== doctorId.toString()) {
    throw new AppError(
      "Patient belongs to a different doctor's clinic workspace",
      400,
      "PATIENT_DOCTOR_MISMATCH"
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
  let sourceAppointment = null;

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

    if (visit.status !== "completed") {
      throw new AppError(
        "A follow-up can only be created from a completed visit",
        400,
        "FOLLOW_UP_VISIT_NOT_COMPLETED"
      );
    }

    sourceAppointment = await Appointment.findById(visit.appointment)
      .session(session);
    if (
      !sourceAppointment ||
      sourceAppointment.patient.toString() !== visit.patient.toString() ||
      sourceAppointment.doctor.toString() !== visit.doctor.toString()
    ) {
      throw new AppError(
        "The originating visit is not linked to its appointment",
        400,
        "FOLLOW_UP_VISIT_MISMATCH"
      );
    }

    if (sourceAppointment.status !== "completed") {
      throw new AppError(
        "A follow-up can only be created from a completed visit",
        400,
        "FOLLOW_UP_VISIT_NOT_COMPLETED"
      );
    }

    if (
      followUpOf &&
      sourceAppointment._id.toString() !== followUpOf.toString()
    ) {
      throw new AppError(
        "Follow-up appointment must reference the originating visit's appointment",
        400,
        "FOLLOW_UP_APPOINTMENT_MISMATCH"
      );
    }
  }

  if (followUpOf) {
    const parentAppointment =
      sourceAppointment ||
      (await Appointment.findById(followUpOf).session(session));

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

    if (parentAppointment.status !== "completed") {
      throw new AppError(
        "A follow-up can only be linked to a completed appointment",
        400,
        "FOLLOW_UP_APPOINTMENT_NOT_COMPLETED"
      );
    }
  }

  return sourceAppointment?._id || followUpOf || null;
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

  if (data.isFollowUp && currentUser?.role !== "doctor") {
    throw new AppError(
      "Only doctors can create follow-up appointments",
      403,
      "FORBIDDEN"
    );
  }

  if (!data.isFollowUp && data.followUpReason?.trim()) {
    throw new AppError(
      "A follow-up reason can only be set on a follow-up appointment",
      400,
      "FOLLOW_UP_REASON_REQUIRES_FOLLOW_UP"
    );
  }

  const hasFollowUpReference = Boolean(originatingVisit || followUpOf);

  if (Boolean(data.isFollowUp) !== hasFollowUpReference) {
    throw new AppError(
      "Follow-up appointments must reference an originating visit or appointment",
      400,
      "FOLLOW_UP_REFERENCE_REQUIRED"
    );
  }

  if (data.isFollowUp && !originatingVisit) {
    throw new AppError(
      "A follow-up appointment must reference its originating visit",
      400,
      "FOLLOW_UP_VISIT_REQUIRED"
    );
  }

  if (currentUser?.role === "doctor" && !data.isFollowUp) {
    throw new AppError(
      "Doctors can only create follow-up appointments",
      403,
      "FORBIDDEN"
    );
  }

  if (appointment <= new Date()) {
    throw new AppError(
      "Appointment date must be in the future",
      400,
      "INVALID_APPOINTMENT_DATE"
    );
  }

  if (currentUser) {
    await assertDoctorAccess(currentUser, doctor);
  }

  return withAppointmentTransaction(async (session) => {
    await lockDoctorAppointmentBookings(doctor, session);
    await validatePatient(patient, session, doctor);
    await validateDoctor(doctor, session);

    const schedule = await getDoctorSchedule(doctor, appointmentDate, session);
    validateAppointmentTime(appointmentDate, duration, schedule);

    const resolvedFollowUpOf = await validateFollowUpReferences({
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
          followUpOf: resolvedFollowUpOf,
          followUpReason: data.isFollowUp ? data.followUpReason : null,
          createdBy: currentUser._id,
          statusHistory: createInitialStatusHistory(currentUser),
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
  if (query.originatingVisit) {
    filter.originatingVisit = query.originatingVisit;
  }
  if (query.status) filter.status = query.status;
  applyCairoDateRange(filter, "appointmentDate", query);
  await applyClinicScope(filter, query, currentUser, "doctor");
  const appointmentQuery = Appointment.find(filter);
  if (currentUser?.role === "receptionist") {
    appointmentQuery.select("-followUpReason");
  }

  return paginateQuery(
    appointmentQuery
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
          [
            "appointmentDate",
            "checkedInAt",
            "status",
            "createdAt",
            "updatedAt",
          ],
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
  const appointmentQuery = Appointment.findById(id);
  if (currentUser?.role === "receptionist") {
    appointmentQuery.select("-followUpReason");
  }

  const appointment = await appointmentQuery
    .populate("patient", "firstName lastName phone email dateOfBirth gender")
    .populate({
      path: "doctor",
      select: "user specialization licenseNumber consultationFee profilePhoto",
      populate: {
        path: "user",
        select: "firstName lastName email phone",
      },
    })
    .populate(
      "statusHistory.changedBy confirmedBy checkedInBy startedBy completedBy cancelledBy noShowBy",
      "firstName lastName role"
    );

  if (!appointment) return null;

  if (currentUser) {
    if (currentUser.role === "doctor") {
      const authorizedDoctorIds = await getAuthorizedDoctorIds(currentUser);
      const appDoctorId = (appointment.doctor?._id || appointment.doctor).toString();
      if (
        !authorizedDoctorIds ||
        !authorizedDoctorIds.some((docId) => docId.toString() === appDoctorId)
      ) {
        return null;
      }
    } else {
      await assertDoctorAccess(
        currentUser,
        appointment.doctor?._id || appointment.doctor
      );
    }
  }

  return appointment;
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

    if (currentUser) {
      await assertDoctorAccess(currentUser, appointment.doctor);
    }

    const newDate =
      data.appointmentDate !== undefined
        ? data.appointmentDate
        : appointment.appointmentDate;
    const newDuration =
      data.duration !== undefined ? data.duration : appointment.duration;

    const isRescheduled =
      Boolean(data.appointmentDate) &&
      toClinicDate(data.appointmentDate).getTime() !==
        toClinicDate(previousValues.appointmentDate).getTime();

    const isDurationChanged =
      data.duration !== undefined &&
      data.duration !== previousValues.duration;

    if (
      currentUser?.role === "doctor" &&
      Object.keys(data).some(
        (field) => !["status", "cancellationReason"].includes(field)
      )
    ) {
      throw new AppError(
        "Doctors can only update appointment status through the clinical workflow",
        403,
        "FORBIDDEN"
      );
    }

    if (
      appointment.status !== "scheduled" &&
      appointment.status !== "confirmed" &&
      (isRescheduled || isDurationChanged)
    ) {
      throw new AppError(
        "Only scheduled or confirmed appointments can be rescheduled",
        400,
        "INVALID_APPOINTMENT_STATUS"
      );
    }

    if (data.cancellationReason !== undefined && data.status !== "cancelled") {
      throw new AppError(
        "A cancellation reason can only be set when cancelling an appointment",
        400,
        "INVALID_CANCELLATION_REASON"
      );
    }

    if (
      ["in_progress", "completed"].includes(data.status) &&
      currentUser?.role !== "doctor"
    ) {
      throw new AppError(
        "Only the assigned doctor can perform examination operations",
        403,
        "FORBIDDEN"
      );
    }

    if (isRescheduled || isDurationChanged) {
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
        originatingVisit: appointment.originatingVisit,
        doctorId: appointment.doctor,
        patientId: appointment.patient,
        excludeAppointmentId: id,
        session,
      });
    }

    const allowedFields = [
      "appointmentDate",
      "duration",
      "reason",
      "notes",
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        appointment[field] = data[field];
      }
    }

    if (data.status === "completed") {
      const visit = await Visit.findOne({ appointment: appointment._id })
        .session(session);
      if (!visit) {
        throw new AppError(
          "An appointment cannot be completed before its visit is recorded",
          400,
          "VISIT_REQUIRED_FOR_COMPLETION"
        );
      }

      if (
        visit.patient.toString() !== appointment.patient.toString() ||
        visit.doctor.toString() !== appointment.doctor.toString()
      ) {
        throw new AppError(
          "The visit does not belong to this appointment's patient and doctor",
          400,
          "VISIT_APPOINTMENT_MISMATCH"
        );
      }

      if (visit.status !== "completed") {
        throw new AppError(
          "An appointment cannot be completed before its visit is completed",
          400,
          "VISIT_NOT_COMPLETED"
        );
      }
    }

    if (data.status !== undefined) {
      transitionAppointment(appointment, data.status, currentUser, {
        reason: data.cancellationReason,
      });
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
      statusHistory: appointment.statusHistory,
    };

    let auditAction = "APPOINTMENT_UPDATED";
    if (data.status === "cancelled") {
      auditAction = "APPOINTMENT_CANCELLED";
    } else if (data.status === "no-show") {
      auditAction = "APPOINTMENT_NO_SHOW";
    } else if (isRescheduled) {
      auditAction = "APPOINTMENT_RESCHEDULED";
    }

    if (currentUser?._id) {
      await auditLogService.logActivity({
        actor: currentUser,
        action: auditAction,
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
  return updateAppointment(
    id,
    { status: "cancelled", cancellationReason },
    currentUser
  );
};

module.exports = {
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
};