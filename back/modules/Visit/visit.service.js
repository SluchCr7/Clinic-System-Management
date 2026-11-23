const mongoose = require("mongoose");
const Visit = require("./visit.model");
const Appointment = require("../Appointment/appointment.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const {
  getSort,
  applyDoctorScope,
} = require("../../utils/listQuery");
const { transitionAppointment } = require("../../utils/appointmentLifecycle");
const LabOrder = require("../LabOrder/labOrder.model");
const Notification = require("../Notification/notification.model");
const { getAuthorizedReceptionistIds } = require("../../utils/accessControl");
const { getIO } = require("../../utils/socket");
const {
  checkDoctorAvailability,
  throwAvailabilityConflict,
} = require("../../utils/doctorAvailability");

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

const validateAppointment = async (
  appointmentId,
  patientId,
  doctorId,
  session
) => {
  const appointment = await Appointment.findById(appointmentId).session(session);

  if (!appointment) {
    throw new AppError(
      "Appointment not found",
      404,
      "APPOINTMENT_NOT_FOUND"
    );
  }

  if (appointment.patient.toString() !== patientId.toString()) {
    throw new AppError(
      "Appointment does not belong to this patient",
      400,
      "APPOINTMENT_PATIENT_MISMATCH"
    );
  }

  if (appointment.doctor.toString() !== doctorId.toString()) {
    throw new AppError(
      "Appointment does not belong to this doctor",
      400,
      "APPOINTMENT_DOCTOR_MISMATCH"
    );
  }

  return appointment;
};

const createVisit = async (data, currentUser) => {
  const { appointment, patient, doctor } = data;

  if (!currentUser || currentUser.role !== "doctor") {
    throw new AppError(
      "Only doctors have permission to conduct and record clinical visits",
      403,
      "FORBIDDEN"
    );
  }

  const session = await mongoose.startSession();
  const startedAt = new Date();
  let createdVisit;

  try {
    await session.withTransaction(async () => {
      const doctorRecord = await Doctor.findOne({
        user: currentUser._id,
        isActive: true,
      })
        .select("_id")
        .session(session)
        .exec();

      if (!doctorRecord || doctorRecord._id.toString() !== doctor.toString()) {
        throw new AppError(
          "Doctors can only create visits for themselves",
          403,
          "FORBIDDEN"
        );
      }

      const patientRecord = await Patient.findById(patient).session(session);
      if (!patientRecord) {
        throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
      }
      if (!patientRecord.isActive) {
        throw new AppError("Patient is inactive", 400, "PATIENT_INACTIVE");
      }
      if (
        patientRecord.doctor &&
        patientRecord.doctor.toString() !== doctor.toString()
      ) {
        throw new AppError(
          "Patient does not belong to this doctor's clinic",
          400,
          "PATIENT_DOCTOR_MISMATCH"
        );
      }

      const appointmentData = await validateAppointment(
        appointment,
        patient,
        doctor,
        session
      );
      const existingVisit = await Visit.findOne({ appointment }).session(session);

      if (existingVisit) {
        throw new AppError(
          "A visit already exists for this appointment",
          409,
          "VISIT_ALREADY_EXISTS"
        );
      }

      await validateDoctor(doctor, session);
      if (appointmentData.status !== "checked_in") {
        throw new AppError(
          "Only checked-in appointments can start a visit",
          400,
          "INVALID_APPOINTMENT_STATUS"
        );
      }

      await Doctor.updateOne(
        { _id: doctor },
        { $inc: { appointmentBookingVersion: 1 } },
        { session }
      );

      const visitStart = startedAt;
      const visitEnd = new Date(
        new Date(appointmentData.appointmentDate).getTime() +
          (appointmentData.duration || 30) * 60 * 1000
      );
      const availability = await checkDoctorAvailability({
        doctorId: doctor,
        patientId: patient,
        start: visitStart,
        end: visitEnd,
        excludeAppointmentId: appointmentData._id,
        session,
        checkWorkingHours: false,
      });
      throwAvailabilityConflict(availability);


      const [visit] = await Visit.create(
        [
          {
            appointment: appointmentData._id,
            patient: appointmentData.patient,
            doctor: appointmentData.doctor,
            chiefComplaint: data.chiefComplaint,
            symptoms: data.symptoms,
            vitals: data.vitals,
            examination: data.examination,
            diagnosis: data.diagnosis,
            doctorNotes: data.doctorNotes,
            followUpDate: data.followUpDate,
            followUpReason: data.followUpReason,
            status: "in_progress",
            startedAt,
            statusHistory: [
              {
                from: null,
                to: "in_progress",
                changedBy: currentUser._id,
                changedAt: startedAt,
              },
            ],
            createdBy: currentUser._id,
            updatedBy: currentUser._id,
          },
        ],
        { session }
      );

      transitionAppointment(appointmentData, "in_progress", currentUser, {
        source: "visit",
        changedAt: startedAt,
      });
      appointmentData.updatedBy = currentUser._id;
      await appointmentData.save({ session });

      const warningEnd = new Date(startedAt.getTime() + 15 * 60 * 1000);
      const upcoming = await Appointment.findOne({
        doctor,
        patient: { $ne: patient },
        status: { $in: ["scheduled", "confirmed", "checked_in"] },
        appointmentDate: { $gte: startedAt, $lte: warningEnd },
      })
        .populate("patient", "firstName lastName")
        .session(session);
      if (upcoming) {
        const patientName =
          upcoming.patient
            ? `${upcoming.patient.firstName || ""} ${upcoming.patient.lastName || ""}`.trim()
            : "المريض";
        const time = new Intl.DateTimeFormat("ar-EG", {
          timeZone: "Africa/Cairo",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(new Date(upcoming.appointmentDate));
        await Notification.findOneAndUpdate(
          { eventKey: `visit-start-nearby:${visit._id}:${upcoming._id}:${currentUser._id}` },
          {
            $setOnInsert: {
              recipient: currentUser._id,
              type: "appointment",
              title: "تنبيه موعد قريب",
              message: `تنبيه: عندك موعد للمريض ${patientName} الساعة ${time}`,
              relatedModel: "Appointment",
              relatedId: upcoming._id,
              eventKey: `visit-start-nearby:${visit._id}:${upcoming._id}:${currentUser._id}`,
              createdBy: currentUser._id,
              actor: currentUser._id,
              entityType: "Appointment",
              entityId: upcoming._id,
              link: `/appointments`,
              priority: "medium",
            },
          },
          { upsert: true, new: true, session }
        );
      }

      await auditLogService.logActivity({
        actor: currentUser,
        action: "VISIT_CREATED",
        resource: "Visit",
        resourceId: visit._id,
        details: {
          appointment: visit.appointment,
          patient: visit.patient,
          doctor: visit.doctor,
        },
        session,
      });

      createdVisit = visit;
    });

    return createdVisit;
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.appointment || (error.keyValue && error.keyValue.appointment)) {
        throw new AppError(
          "A visit already exists for this appointment",
          409,
          "VISIT_ALREADY_EXISTS"
        );
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

const getVisits = async (query = {}, currentUser = null) => {
  if (!["admin", "doctor"].includes(currentUser?.role)) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  const filter = {};

  if (query.patient) filter.patient = query.patient;
  if (query.doctor) filter.doctor = query.doctor;
  if (query.appointment) filter.appointment = query.appointment;
  if (query.status) filter.status = query.status;
  await applyDoctorScope(filter, query, currentUser, Doctor);

  return paginateQuery(
    Visit.find(filter)
      .populate(
        "patient",
        "firstName lastName phone email dateOfBirth gender bloodType"
      )
      .populate({
        path: "doctor",
        select: "user specialization licenseNumber consultationFee profilePhoto",
        populate: {
          path: "user",
          select: "firstName lastName email phone",
        },
      })
      .populate({
        path: "appointment",
        select: "appointmentDate duration status reason",
      })
      .sort(
        getSort(
          query,
          ["createdAt", "updatedAt", "followUpDate"],
          "createdAt"
        )
      ),
    Visit.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getVisitById = async (id, currentUser = null) => {
  if (!["admin", "doctor"].includes(currentUser?.role)) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  const filter = { _id: id };
  if (currentUser.role === "doctor") {
    const doctor = await Doctor.findOne({
      user: currentUser._id,
    })
      .select("_id")
      .lean()
      .exec();

    if (!doctor) return null;
    filter.doctor = doctor._id;
  }

  const visit = await Visit.findOne(filter)
    .populate(
      "patient",
      "firstName lastName phone email dateOfBirth gender bloodType doctor"
    )
    .populate({
      path: "doctor",
      select: "user specialization licenseNumber consultationFee profilePhoto",
      populate: {
        path: "user",
        select: "firstName lastName email phone",
      },
    })
    .populate({
      path: "appointment",
      select: "patient doctor appointmentDate duration status reason",
    });

  if (!visit) {
    return null;
  }

  if (!visit.appointment || !visit.patient || !visit.doctor) {
    return null;
  }

  const visitDoctorId = visit.doctor?._id || visit.doctor;
  const visitPatientId = visit.patient?._id || visit.patient;
  if (
    !visit.appointment ||
    visit.appointment.patient?.toString() !== visitPatientId.toString() ||
    visit.appointment.doctor?.toString() !== visitDoctorId.toString() ||
    (visit.patient.doctor &&
      visit.patient.doctor.toString() !== visitDoctorId.toString())
  ) {
    return null;
  }

  return visit;
};

const updateVisit = async (id, data, currentUser) => {
  if (!currentUser || currentUser.role !== "doctor") {
    throw new AppError(
      "Only doctors have permission to update clinical records",
      403,
      "FORBIDDEN"
    );
  }

  const session = await mongoose.startSession();
  let updatedVisit;

  try {
    await session.withTransaction(async () => {
      const doctor = await Doctor.findOne({ user: currentUser._id })
        .select("_id")
        .session(session)
        .exec();
      if (!doctor) return;

      const visit = await Visit.findOne({
        _id: id,
        doctor: doctor._id,
      }).session(session);
      if (!visit) return;

      if (visit.status !== "in_progress") {
        throw new AppError(
          "Completed visits cannot be edited",
          409,
          "VISIT_NOT_EDITABLE"
        );
      }

      const appointment = await Appointment.findById(visit.appointment)
        .session(session);
      const patient = await Patient.findById(visit.patient).session(session);
      if (
        !appointment ||
        !patient ||
        (patient.doctor &&
          patient.doctor.toString() !== visit.doctor.toString()) ||
        appointment.patient.toString() !== visit.patient.toString() ||
        appointment.doctor.toString() !== visit.doctor.toString() ||
        appointment.status !== "in_progress"
      ) {
        throw new AppError(
          "Visit and appointment lifecycle are inconsistent",
          409,
          "VISIT_APPOINTMENT_STATUS_MISMATCH"
        );
      }

      const allowedFields = [
        "chiefComplaint",
        "symptoms",
        "vitals",
        "examination",
        "diagnosis",
        "doctorNotes",
        "followUpDate",
        "followUpReason",
      ];
      const updatedFields = [];

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          visit[field] = data[field];
          updatedFields.push(field);
        }
      }

      visit.updatedBy = currentUser._id;
      await visit.save({ session });
      await auditLogService.logActivity({
        actor: currentUser,
        action: "VISIT_UPDATED",
        resource: "Visit",
        resourceId: visit._id,
        details: { updatedFields },
        session,
      });

      updatedVisit = visit;
    });

    return updatedVisit || null;
  } finally {
    await session.endSession();
  }
};

const completeVisit = async (id, currentUser) => {
  if (!currentUser || currentUser.role !== "doctor") {
    throw new AppError(
      "Only the assigned doctor can complete a visit",
      403,
      "FORBIDDEN"
    );
  }

  const session = await mongoose.startSession();
  const completedAt = new Date();
  let completedVisit;
  const createdVisitNotifications = [];

  try {
    await session.withTransaction(async () => {
      const doctor = await Doctor.findOne({
        user: currentUser._id,
        isActive: true,
      })
        .select("_id")
        .session(session)
        .exec();
      if (!doctor) return;

      const visit = await Visit.findOne({
        _id: id,
        doctor: doctor._id,
      }).session(session);
      if (!visit) return;

      const appointment = await Appointment.findById(visit.appointment)
        .session(session);
      const patient = await Patient.findById(visit.patient).session(session);
      if (
        !appointment ||
        !patient ||
        (patient.doctor &&
          patient.doctor.toString() !== visit.doctor.toString()) ||
        appointment.patient.toString() !== visit.patient.toString() ||
        appointment.doctor.toString() !== visit.doctor.toString()
      ) {
        throw new AppError(
          "Visit and appointment relationship is invalid",
          409,
          "VISIT_APPOINTMENT_MISMATCH"
        );
      }

      if (visit.status === "completed" && appointment.status === "completed") {
        completedVisit = visit;
        return;
      }

      if (visit.status !== "in_progress" || appointment.status !== "in_progress") {
        throw new AppError(
          "Visit and appointment must both be in progress before completion",
          409,
          "VISIT_APPOINTMENT_STATUS_MISMATCH"
        );
      }

      visit.status = "completed";
      visit.completedAt = completedAt;
      visit.completedBy = currentUser._id;
      visit.updatedBy = currentUser._id;
      visit.statusHistory.push({
        from: "in_progress",
        to: "completed",
        changedBy: currentUser._id,
        changedAt: completedAt,
      });

      transitionAppointment(appointment, "completed", currentUser, {
        changedAt: completedAt,
      });
      appointment.updatedBy = currentUser._id;

      await visit.save({ session });
      await appointment.save({ session });
      await auditLogService.logActivity({
        actor: currentUser,
        action: "VISIT_COMPLETED",
        resource: "Visit",
        resourceId: visit._id,
        details: { appointment: appointment._id },
        session,
      });
      await auditLogService.logActivity({
        actor: currentUser,
        action: "APPOINTMENT_COMPLETED",
        resource: "Appointment",
        resourceId: appointment._id,
        details: { visit: visit._id },
        session,
      });

      const openReferralCount = await LabOrder.countDocuments({
        visit: visit._id,
        status: "REQUESTED",
      }).session(session);
      const receptionistIds = await getAuthorizedReceptionistIds(visit.doctor);

      for (const receptionistId of receptionistIds) {
        if (receptionistId.toString() === currentUser._id.toString()) continue;
        const eventKey =
          `visit-completed:${visit._id}:${receptionistId}`;
        const referralText =
          openReferralCount > 0
            ? ` مطلوب منه ${openReferralCount} تحاليل/أشعة`
            : "";
        const notification = await Notification.findOneAndUpdate(
          { eventKey },
          {
            $setOnInsert: {
              recipient: receptionistId,
              type: "visit_completed",
              title: "جهّز الفاتورة",
              message:
                `تمّت زيارة المريض ${patient.firstName} ${patient.lastName}.${referralText}`,
              relatedModel: "Visit",
              relatedId: visit._id,
              eventKey,
              createdBy: currentUser._id,
              actor: currentUser._id,
              entityType: "Visit",
              entityId: visit._id,
              link: `/visits/${visit._id}?action=invoice`,
              priority: "high",
            },
          },
          { upsert: true, new: true, session }
        );
        createdVisitNotifications.push(notification);
      }

      completedVisit = visit;
    });

    for (const notification of createdVisitNotifications) {
      if (!notification) continue;
      try {
        getIO().to(`user:${notification.recipient}`).emit("notification:new", {
          notification,
        });
      } catch {
        // Notification persistence is authoritative; Socket delivery is best-effort.
      }
    }

    return completedVisit || null;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createVisit,
  getVisits,
  getVisitById,
  updateVisit,
  completeVisit,
};
