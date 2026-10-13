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

const validateAppointment = async (appointmentId, patientId, doctorId) => {
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    throw new AppError(
      "Appointment not found",
      404,
      "APPOINTMENT_NOT_FOUND"
    );
  }

  if (appointment.patient.toString() !== patientId) {
    throw new AppError(
      "Appointment does not belong to this patient",
      400,
      "APPOINTMENT_PATIENT_MISMATCH"
    );
  }

  if (appointment.doctor.toString() !== doctorId) {
    throw new AppError(
      "Appointment does not belong to this doctor",
      400,
      "APPOINTMENT_DOCTOR_MISMATCH"
    );
  }

  if (!["scheduled", "confirmed", "checked_in"].includes(appointment.status)) {
    throw new AppError(
      "Appointment cannot be used to create a visit",
      400,
      "INVALID_APPOINTMENT_STATUS"
    );
  }

  return appointment;
};

const createVisit = async (data, currentUser) => {
  const { appointment, patient, doctor } = data;

  if (currentUser?.role === "doctor") {
    const doctorRecord = await Doctor.findOne({ user: currentUser._id })
      .select("_id")
      .lean()
      .exec();

    if (!doctorRecord || doctorRecord._id.toString() !== doctor.toString()) {
      throw new AppError(
        "Doctors can only create visits for themselves",
        403,
        "FORBIDDEN"
      );
    }
  }

  await validatePatient(patient);
  await validateDoctor(doctor);

  const appointmentData = await validateAppointment(appointment, patient, doctor);

  const existingVisit = await Visit.findOne({ appointment });

  if (existingVisit) {
    throw new AppError(
      "A visit already exists for this appointment",
      409,
      "VISIT_ALREADY_EXISTS"
    );
  }

  const visit = await Visit.create({
    ...data,
    createdBy: currentUser._id,
  });

  appointmentData.status = "completed";
  appointmentData.updatedBy = currentUser._id;
  await appointmentData.save();

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "VISIT_CREATED",
      resource: "Visit",
      resourceId: visit._id,
      details: {
        appointment: visit.appointment,
        patient: visit.patient,
        doctor: visit.doctor,
        chiefComplaint: visit.chiefComplaint,
        diagnosis: visit.diagnosis,
        followUpDate: visit.followUpDate,
      },
    });
  }

  return visit;
};

const getVisits = async (query = {}, currentUser = null) => {
  const filter = {};

  if (query.patient) filter.patient = query.patient;
  if (query.doctor) filter.doctor = query.doctor;
  await applyDoctorScope(filter, query, currentUser, Doctor);

  return paginateQuery(
    Visit.find(filter)
      .populate(
        "patient",
        "firstName lastName phone email dateOfBirth gender bloodType"
      )
      .populate({
        path: "doctor",
        select: "user specialization licenseNumber profilePhoto",
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
  const visit = await Visit.findById(id)
    .populate(
      "patient",
      "firstName lastName phone email dateOfBirth gender bloodType"
    )
    .populate({
      path: "doctor",
      select: "user specialization licenseNumber profilePhoto",
      populate: {
        path: "user",
        select: "firstName lastName email phone",
      },
    })
    .populate({
      path: "appointment",
      select: "appointmentDate duration status reason",
    });

  if (!visit) {
    return null;
  }

  if (currentUser?.role === "doctor") {
    const doctor = await Doctor.findOne({
      user: currentUser._id,
    })
      .select("_id")
      .lean()
      .exec();

    const visitDoctorId = visit.doctor?._id || visit.doctor;
    if (!doctor || doctor._id.toString() !== visitDoctorId.toString()) {
      return null;
    }
  }

  return visit;
};

const updateVisit = async (id, data, currentUser) => {
  const visit = await Visit.findById(id);

  if (!visit) {
    return null;
  }

  if (currentUser?.role === "doctor") {
    const doctor = await Doctor.findOne({
      user: currentUser._id,
    })
      .select("_id")
      .lean()
      .exec();

    if (!doctor || doctor._id.toString() !== visit.doctor.toString()) {
      return null;
    }
  }

  const previousValues = {
    appointment: visit.appointment,
    patient: visit.patient,
    doctor: visit.doctor,
    chiefComplaint: visit.chiefComplaint,
    diagnosis: visit.diagnosis,
    followUpDate: visit.followUpDate,
  };

  const allowedFields = [
    "chiefComplaint",
    "symptoms",
    "vitals",
    "examination",
    "diagnosis",
    "doctorNotes",
    "followUpDate",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      visit[field] = data[field];
    }
  }

  visit.updatedBy = currentUser._id;

  await visit.save();

  const newValues = {
    appointment: visit.appointment,
    patient: visit.patient,
    doctor: visit.doctor,
    chiefComplaint: visit.chiefComplaint,
    diagnosis: visit.diagnosis,
    followUpDate: visit.followUpDate,
  };

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "VISIT_UPDATED",
      resource: "Visit",
      resourceId: visit._id,
      details: {
        previousValues,
        newValues,
      },
    });
  }

  return visit;
};

module.exports = {
  createVisit,
  getVisits,
  getVisitById,
  updateVisit,
};