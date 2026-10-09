const Doctor = require("./doctor.model");
const User = require("../User/user.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const { getSearchRegex, getSort } = require("../../utils/listQuery");

const createDoctor = async (data, currentUser) => {
  const user = await User.findById(data.user);

  if (!user) {
    throw new AppError(
      "User not found",
      404,
      "USER_NOT_FOUND"
    );
  }

  if (user.role !== "doctor") {
    throw new AppError(
      "Selected user must have a doctor role",
      400,
      "INVALID_DOCTOR_ROLE"
    );
  }

  if (!user.isActive) {
    throw new AppError(
      "Doctor user account is inactive",
      400,
      "INACTIVE_DOCTOR_ACCOUNT"
    );
  }

  const existingDoctor = await Doctor.findOne({
    user: data.user,
  });

  if (existingDoctor) {
    throw new AppError(
      "Doctor profile already exists",
      409,
      "DOCTOR_PROFILE_EXISTS"
    );
  }

  const doctor = await Doctor.create({
    ...data,
    createdBy: currentUser._id,
  });

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "DOCTOR_CREATED",
      resource: "Doctor",
      resourceId: doctor._id,
      details: {
        user: doctor.user,
        specialization: doctor.specialization,
        licenseNumber: doctor.licenseNumber,
        consultationFee: doctor.consultationFee,
        yearsOfExperience: doctor.yearsOfExperience,
        isActive: doctor.isActive,
      },
    });
  }

  return doctor;
};

const getDoctors = async (query = {}) => {
  const filter = {
    isActive:
      query.isActive === true || query.isActive === "true"
        ? true
        : query.isActive === false || query.isActive === "false"
          ? false
          : true,
  };

  if (query.specialization) {
    filter.specialization = query.specialization;
  }

  const searchRegex = getSearchRegex(query.search);
  if (searchRegex) {
    filter.$or = [
      { specialization: searchRegex },
      { licenseNumber: searchRegex },
    ];
  }

  return paginateQuery(
    Doctor.find(filter)
      .populate(
        "user",
        "firstName lastName email phone role"
      )
      .sort(
        getSort(
          query,
          [
            "specialization",
            "licenseNumber",
            "consultationFee",
            "yearsOfExperience",
            "createdAt",
            "updatedAt",
          ],
          "createdAt"
        )
      ),
    Doctor.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getDoctorById = async (id) => {
  return await Doctor.findById(id).populate(
    "user",
    "firstName lastName email phone role"
  );
};

const updateDoctor = async (id, data, currentUser) => {
  const doctor = await Doctor.findById(id);

  if (!doctor) {
    return null;
  }

  const previousValues = {
    user: doctor.user,
    specialization: doctor.specialization,
    licenseNumber: doctor.licenseNumber,
    consultationFee: doctor.consultationFee,
    yearsOfExperience: doctor.yearsOfExperience,
    isActive: doctor.isActive,
  };

  Object.assign(doctor, data);
  doctor.updatedBy = currentUser._id;

  await doctor.save();

  const newValues = {
    user: doctor.user,
    specialization: doctor.specialization,
    licenseNumber: doctor.licenseNumber,
    consultationFee: doctor.consultationFee,
    yearsOfExperience: doctor.yearsOfExperience,
    isActive: doctor.isActive,
  };

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "DOCTOR_UPDATED",
      resource: "Doctor",
      resourceId: doctor._id,
      details: {
        previousValues,
        newValues,
      },
    });
  }

  return doctor;
};

const deactivateDoctor = async (id, currentUser) => {
  const doctor = await Doctor.findById(id);

  if (!doctor) {
    return null;
  }

  const previousIsActive = doctor.isActive;
  doctor.isActive = false;
  doctor.updatedBy = currentUser._id;

  await doctor.save();

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "DOCTOR_DEACTIVATED",
      resource: "Doctor",
      resourceId: doctor._id,
      details: {
        previousIsActive,
        newIsActive: false,
      },
    });
  }

  return doctor;
};

module.exports = {
  createDoctor,
  getDoctors,
  getDoctorById,
  updateDoctor,
  deactivateDoctor,
};