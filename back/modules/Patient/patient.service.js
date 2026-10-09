const Patient = require("./patient.model");
const Appointment = require("../Appointment/appointment.model");
const Doctor = require("../Doctor/doctor.model");
const Visit = require("../Visit/visit.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const { getSearchRegex, getSort } = require("../../utils/listQuery");

const createPatient = async (data, user) => {
  const patient = await Patient.create({
    ...data,
    createdBy: user._id,
  });

  if (user?._id) {
    await auditLogService.logActivity({
      actor: user,
      action: "PATIENT_CREATED",
      resource: "Patient",
      resourceId: patient._id,
      details: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
        bloodType: patient.bloodType,
        isActive: patient.isActive,
      },
    });
  }

  return patient;
};

const getPatients = async (query = {}, currentUser = null) => {
  const filter = {};

  const {
    search,
    gender,
    bloodType,
    isActive,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  // -------------------------
  // Active status
  // -------------------------

  if (isActive !== undefined) {
    filter.isActive =
      isActive === true || isActive === "true";
  } else {
    filter.isActive = true;
  }

  // -------------------------
  // Search
  // -------------------------

  if (search?.trim()) {
    const searchRegex = getSearchRegex(search);

    filter.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { phone: searchRegex },
      { email: searchRegex },
    ];
  }

  // -------------------------
  // Filters
  // -------------------------

  if (gender) {
    filter.gender = gender;
  }

  if (bloodType) {
    filter.bloodType = bloodType;
  }

  // -------------------------
  // Sorting
  // -------------------------

  const allowedSortFields = [
    "firstName",
    "lastName",
    "dateOfBirth",
    "createdAt",
    "updatedAt",
  ];

  const sort = getSort(
    { sortBy, sortOrder },
    allowedSortFields,
    "createdAt"
  );

  // -------------------------
  // Pagination
  // -------------------------

  if (currentUser?.role === "doctor") {
    const doctor = await Doctor.findOne({
      user: currentUser._id,
    })
      .select("_id")
      .lean()
      .exec();
    const patientIds = doctor
      ? await Appointment.distinct("patient", {
          doctor: doctor._id,
        })
      : [];

    filter._id = { $in: patientIds };
  }

  return paginateQuery(
    Patient.find(filter).sort(sort),
    Patient.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getPatientById = async (id, currentUser = null) => {
  const patient = await Patient.findById(id);

  if (!patient) {
    return null;
  }

  if (currentUser?.role === "doctor") {
    const doctor = await Doctor.findOne({
      user: currentUser._id,
    })
      .select("_id")
      .lean()
      .exec();

    if (!doctor) {
      throw new AppError("Access denied", 403, "FORBIDDEN");
    }

    const [hasAppointment, hasVisit] = await Promise.all([
      Appointment.exists({ doctor: doctor._id, patient: patient._id }),
      Visit.exists({ doctor: doctor._id, patient: patient._id }),
    ]);

    if (!hasAppointment && !hasVisit) {
      throw new AppError(
        "You are not authorized to access this patient's medical record",
        403,
        "FORBIDDEN"
      );
    }
  }

  return patient;
};

const updatePatient = async (id, data, user) => {
  const patient = await Patient.findById(id);

  if (!patient) {
    return null;
  }

  const previousValues = {
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    bloodType: patient.bloodType,
    isActive: patient.isActive,
  };

  Object.assign(patient, data, {
    updatedBy: user?._id || patient.updatedBy,
  });

  await patient.save();

  const newValues = {
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    bloodType: patient.bloodType,
    isActive: patient.isActive,
  };

  if (user?._id) {
    await auditLogService.logActivity({
      actor: user,
      action: "PATIENT_UPDATED",
      resource: "Patient",
      resourceId: patient._id,
      details: {
        previousValues,
        newValues,
      },
    });
  }

  return patient;
};

const deletePatient = async (id, user) => {
  const patient = await Patient.findById(id);

  if (!patient) {
    return null;
  }

  const previousIsActive = patient.isActive;

  patient.isActive = false;
  patient.updatedBy = user?._id || patient.updatedBy;

  await patient.save();

  if (user?._id) {
    await auditLogService.logActivity({
      actor: user,
      action: "PATIENT_DEACTIVATED",
      resource: "Patient",
      resourceId: patient._id,
      details: {
        previousIsActive,
        newIsActive: false,
      },
    });
  }

  return patient;
};

module.exports = {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
};