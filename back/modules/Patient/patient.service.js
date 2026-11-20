const Patient = require("./patient.model");
const Doctor = require("../Doctor/doctor.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const { getSearchRegex, getSort } = require("../../utils/listQuery");
const {
  getAuthorizedDoctorIds,
  isDoctorAuthorizedForUser,
  assertPatientAccess,
  applyClinicScope,
} = require("../../utils/accessControl");

const createPatient = async (data, user) => {
  if (!user || user.role !== "receptionist") {
    throw new AppError(
      "Only receptionists have permission to create patient profiles",
      403,
      "FORBIDDEN"
    );
  }

  let targetDoctorId = data.doctor;

  if (targetDoctorId) {
    const isAuthorized = await isDoctorAuthorizedForUser(user, targetDoctorId);
    if (!isAuthorized) {
      throw new AppError(
        "You are not authorized to assign patients to this doctor",
        403,
        "FORBIDDEN"
      );
    }

    const doctorExists = await Doctor.findOne({
      _id: targetDoctorId,
      isActive: true,
    });
    if (!doctorExists) {
      throw new AppError("Assigned doctor is not active", 400, "DOCTOR_INACTIVE");
    }
  } else {
    const authorizedDoctorIds = await getAuthorizedDoctorIds(user);
    if (!authorizedDoctorIds || authorizedDoctorIds.length === 0) {
      throw new AppError(
        "You are not assigned to any active doctor. Please contact an administrator.",
        403,
        "NO_ASSIGNED_DOCTORS"
      );
    }

    if (authorizedDoctorIds.length === 1) {
      targetDoctorId = authorizedDoctorIds[0];
    } else {
      throw new AppError(
        "Please select a doctor from your assigned doctors",
        400,
        "DOCTOR_SELECTION_REQUIRED"
      );
    }
  }

  const patient = await Patient.create({
    ...data,
    doctor: targetDoctorId,
    createdBy: user._id,
  });

  if (user?._id) {
    await auditLogService.logActivity({
      actor: user,
      action: "PATIENT_CREATED",
      resource: "Patient",
      resourceId: patient._id,
      details: {
        doctor: patient.doctor,
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

  return await Patient.findById(patient._id).populate({
    path: "doctor",
    select: "user specialization licenseNumber consultationFee",
    populate: { path: "user", select: "firstName lastName email" },
  });
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
    filter.isActive = isActive === true || isActive === "true";
  } else {
    filter.isActive = true;
  }

  // -------------------------
  // Multi-Clinic Scoping
  // -------------------------
  await applyClinicScope(filter, query, currentUser, "doctor");

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

  return paginateQuery(
    Patient.find(filter)
      .populate({
        path: "doctor",
        select: "user specialization licenseNumber consultationFee",
        populate: { path: "user", select: "firstName lastName email" },
      })
      .sort(sort),
    Patient.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getPatientById = async (id, currentUser = null) => {
  const patient = await Patient.findById(id).populate({
    path: "doctor",
    select: "user specialization licenseNumber consultationFee",
    populate: { path: "user", select: "firstName lastName email" },
  });

  if (!patient) {
    return null;
  }

  if (currentUser) {
    await assertPatientAccess(currentUser, patient);
  }

  return patient;
};

const updatePatient = async (id, data, user) => {
  const patient = await Patient.findById(id);

  if (!patient) {
    return null;
  }

  if (user) {
    await assertPatientAccess(user, patient);
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

  const allowedFields = [
    "firstName",
    "lastName",
    "dateOfBirth",
    "gender",
    "phone",
    "email",
    "bloodType",
    "allergies",
    "chronicDiseases",
    "address",
    "emergencyContact",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      patient[field] = data[field];
    }
  }

  patient.updatedBy = user?._id || patient.updatedBy;

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

  return await Patient.findById(patient._id).populate({
    path: "doctor",
    select: "user specialization licenseNumber consultationFee",
    populate: { path: "user", select: "firstName lastName email" },
  });
};

const deletePatient = async (id, user) => {
  const patient = await Patient.findById(id);

  if (!patient) {
    return null;
  }

  if (user) {
    await assertPatientAccess(user, patient);
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
