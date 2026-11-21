const DoctorAssignment = require("./doctorAssignment.model");
const Doctor = require("../Doctor/doctor.model");
const User = require("../User/user.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const { getSort } = require("../../utils/listQuery");

/**
 * Retrieve active doctor ObjectIds accessible by a user
 * - admin: null (unrestricted)
 * - doctor: [doctor._id]
 * - receptionist: [doctor._id, ...] (actively assigned doctors only)
 */
const getAuthorizedDoctorIds = async (user) => {
  if (!user) return [];

  if (user.role === "admin") {
    return null; // indicates full access
  }

  if (user.role === "doctor") {
    const doctor = await Doctor.findOne({ user: user._id, isActive: true })
      .select("_id")
      .lean();
    return doctor ? [doctor._id] : [];
  }

  if (user.role === "receptionist") {
    const assignments = await DoctorAssignment.find({
      receptionist: user._id,
      isActive: true,
    })
      .select("doctor")
      .lean();

    const doctorIds = assignments.map((a) => a.doctor);
    if (!doctorIds.length) return [];

    // Ensure doctor is still active
    const activeDoctors = await Doctor.find({
      _id: { $in: doctorIds },
      isActive: true,
    })
      .select("_id")
      .lean();

    return activeDoctors.map((d) => d._id);
  }

  return [];
};

/**
 * Check whether a user is authorized for a specific doctor ID
 */
const isDoctorAuthorizedForUser = async (user, doctorId) => {
  if (!user || !doctorId) return false;
  if (user.role === "admin") return true;

  const authorizedDoctorIds = await getAuthorizedDoctorIds(user);
  if (!authorizedDoctorIds) return true; // admin

  const targetIdStr = doctorId.toString();
  return authorizedDoctorIds.some((id) => id.toString() === targetIdStr);
};

const createAssignment = async (data, adminUser) => {
  const { doctor: doctorId, receptionist: receptionistId, notes } = data;

  const [doctor, receptionist] = await Promise.all([
    Doctor.findById(doctorId),
    User.findById(receptionistId),
  ]);

  if (!doctor) {
    throw new AppError("Doctor not found", 404, "DOCTOR_NOT_FOUND");
  }

  if (!doctor.isActive) {
    throw new AppError("Doctor is inactive", 400, "DOCTOR_INACTIVE");
  }

  if (!receptionist) {
    throw new AppError("Receptionist user not found", 404, "USER_NOT_FOUND");
  }

  if (receptionist.role !== "receptionist") {
    throw new AppError(
      "Target user does not have receptionist role",
      400,
      "INVALID_RECEPTIONIST_ROLE"
    );
  }

  if (!receptionist.isActive) {
    throw new AppError("Receptionist user is inactive", 400, "ACCOUNT_INACTIVE");
  }

  let assignment = await DoctorAssignment.findOne({
    doctor: doctorId,
    receptionist: receptionistId,
  });

  if (assignment) {
    if (assignment.isActive) {
      throw new AppError(
        "Assignment already exists and is active",
        409,
        "ASSIGNMENT_EXISTS"
      );
    }
    assignment.isActive = true;
    if (notes !== undefined) assignment.notes = notes;
    assignment.assignedBy = adminUser._id;
    if (doctor.clinic) assignment.clinic = doctor.clinic;
    await assignment.save();
  } else {
    assignment = await DoctorAssignment.create({
      doctor: doctorId,
      receptionist: receptionistId,
      clinic: doctor.clinic || null,
      assignedBy: adminUser._id,
      notes,
      isActive: true,
    });
  }

  if (receptionist && doctor.clinic) {
    receptionist.clinic = doctor.clinic;
    await receptionist.save();
  }

  if (adminUser?._id) {
    await auditLogService.logActivity({
      actor: adminUser,
      action: "DOCTOR_ASSIGNMENT_CREATED",
      resource: "DoctorAssignment",
      resourceId: assignment._id,
      details: {
        doctor: doctorId,
        receptionist: receptionistId,
        isActive: assignment.isActive,
      },
    });
  }

  return await DoctorAssignment.findById(assignment._id)
    .populate({
      path: "doctor",
      select: "user specialization licenseNumber consultationFee isActive",
      populate: { path: "user", select: "firstName lastName email phone" },
    })
    .populate("receptionist", "firstName lastName email phone isActive")
    .populate("assignedBy", "firstName lastName email");
};

const getAssignments = async (query = {}, currentUser) => {
  const filter = {};

  if (currentUser.role === "admin") {
    if (query.doctor) filter.doctor = query.doctor;
    if (query.receptionist) filter.receptionist = query.receptionist;
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === true || query.isActive === "true";
    }
  } else if (currentUser.role === "receptionist") {
    filter.receptionist = currentUser._id;
    filter.isActive = true;
  } else if (currentUser.role === "doctor") {
    const doctor = await Doctor.findOne({ user: currentUser._id }).select("_id").lean();
    if (!doctor) {
      filter.doctor = { $in: [] };
    } else {
      filter.doctor = doctor._id;
      filter.isActive = true;
    }
  } else {
    filter._id = { $in: [] };
  }

  const sort = getSort(query, ["createdAt", "updatedAt"], "createdAt", "desc");

  return paginateQuery(
    DoctorAssignment.find(filter)
      .populate({
        path: "doctor",
        select: "user specialization licenseNumber consultationFee isActive",
        populate: { path: "user", select: "firstName lastName email phone" },
      })
      .populate("receptionist", "firstName lastName email phone isActive")
      .populate("assignedBy", "firstName lastName email")
      .sort(sort),
    DoctorAssignment.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getAssignmentById = async (id, currentUser) => {
  const assignment = await DoctorAssignment.findById(id)
    .populate({
      path: "doctor",
      select: "user specialization licenseNumber consultationFee isActive",
      populate: { path: "user", select: "firstName lastName email phone" },
    })
    .populate("receptionist", "firstName lastName email phone isActive")
    .populate("assignedBy", "firstName lastName email");

  if (!assignment) return null;

  if (currentUser.role === "receptionist") {
    if (assignment.receptionist._id.toString() !== currentUser._id.toString()) {
      throw new AppError("Access denied", 403, "FORBIDDEN");
    }
  } else if (currentUser.role === "doctor") {
    const doctor = await Doctor.findOne({ user: currentUser._id }).select("_id").lean();
    if (!doctor || assignment.doctor._id.toString() !== doctor._id.toString()) {
      throw new AppError("Access denied", 403, "FORBIDDEN");
    }
  }

  return assignment;
};

const updateAssignment = async (id, data, adminUser) => {
  const assignment = await DoctorAssignment.findById(id);
  if (!assignment) return null;

  const previousValues = {
    isActive: assignment.isActive,
    notes: assignment.notes,
  };

  if (data.isActive !== undefined) assignment.isActive = data.isActive;
  if (data.notes !== undefined) assignment.notes = data.notes;
  assignment.assignedBy = adminUser._id;

  await assignment.save();

  if (adminUser?._id) {
    await auditLogService.logActivity({
      actor: adminUser,
      action: "DOCTOR_ASSIGNMENT_UPDATED",
      resource: "DoctorAssignment",
      resourceId: assignment._id,
      details: {
        previousValues,
        newValues: {
          isActive: assignment.isActive,
          notes: assignment.notes,
        },
      },
    });
  }

  return await DoctorAssignment.findById(assignment._id)
    .populate({
      path: "doctor",
      select: "user specialization licenseNumber consultationFee isActive",
      populate: { path: "user", select: "firstName lastName email phone" },
    })
    .populate("receptionist", "firstName lastName email phone isActive")
    .populate("assignedBy", "firstName lastName email");
};

const deleteAssignment = async (id, adminUser) => {
  const assignment = await DoctorAssignment.findById(id);
  if (!assignment) return null;

  assignment.isActive = false;
  assignment.assignedBy = adminUser._id;
  await assignment.save();

  if (adminUser?._id) {
    await auditLogService.logActivity({
      actor: adminUser,
      action: "DOCTOR_ASSIGNMENT_DEACTIVATED",
      resource: "DoctorAssignment",
      resourceId: assignment._id,
      details: { doctor: assignment.doctor, receptionist: assignment.receptionist },
    });
  }

  return assignment;
};

const getMyDoctors = async (currentUser) => {
  if (!currentUser) return [];

  if (currentUser.role === "admin") {
    return Doctor.find({ isActive: true })
      .populate("user", "firstName lastName email phone")
      .lean();
  }

  const authorizedDoctorIds = await getAuthorizedDoctorIds(currentUser);
  if (!authorizedDoctorIds || !authorizedDoctorIds.length) {
    return [];
  }

  return Doctor.find({
    _id: { $in: authorizedDoctorIds },
    isActive: true,
  })
    .populate("user", "firstName lastName email phone")
    .lean();
};

module.exports = {
  getAuthorizedDoctorIds,
  isDoctorAuthorizedForUser,
  getMyDoctors,
  createAssignment,
  getAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
};
