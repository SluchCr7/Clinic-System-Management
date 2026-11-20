const DoctorAssignment = require("../modules/DoctorAssignment/doctorAssignment.model");
const Doctor = require("../modules/Doctor/doctor.model");
const Patient = require("../modules/Patient/patient.model");
const { AppError } = require("../middlewares/errorHandler");

/**
 * Get the list of doctor ObjectIds that the user is authorized to manage or access.
 * - admin: null (unrestricted access)
 * - doctor: [doctor._id] (their own doctor profile)
 * - receptionist: [doctor._id, ...] (all actively assigned doctors)
 */
const getAuthorizedDoctorIds = async (user) => {
  if (!user) return [];

  if (user.role === "admin") {
    return null;
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
 * Check if the user is authorized for a specific doctor
 */
const isDoctorAuthorizedForUser = async (user, doctorId) => {
  if (!user) return false;
  if (user.role === "admin") return true;

  const targetDoctorId = doctorId?._id || doctorId;
  if (!targetDoctorId) return false;
  const targetDoctorStr = targetDoctorId.toString();

  const authorizedDoctorIds = await getAuthorizedDoctorIds(user);
  if (!authorizedDoctorIds) return true;

  return authorizedDoctorIds.some(
    (id) => (id?._id || id).toString() === targetDoctorStr
  );
};

/**
 * Validate that the current user has access to a specific doctor ID
 */
const assertDoctorAccess = async (user, doctorId) => {
  if (!user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }

  const isAuthorized = await isDoctorAuthorizedForUser(user, doctorId);
  if (!isAuthorized) {
    throw new AppError(
      user.role === "receptionist"
        ? "You are not assigned to this doctor's clinic"
        : "You do not have permission to access another doctor's workspace",
      403,
      "FORBIDDEN"
    );
  }

  return true;
};

/**
 * Validate that the current user has access to a specific patient
 */
const assertPatientAccess = async (user, patient) => {
  if (!user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }

  if (user.role === "admin") {
    return true;
  }

  if (!patient) {
    throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
  }

  if (!patient.doctor) {
    throw new AppError(
      "You do not have permission to access this patient",
      403,
      "FORBIDDEN"
    );
  }

  return await assertDoctorAccess(user, patient.doctor);
};

/**
 * Apply clinic / doctor workspace scoping to MongoDB query filters
 */
const applyClinicScope = async (
  filter,
  query,
  user,
  doctorField = "doctor"
) => {
  if (!user) {
    filter[doctorField] = { $in: [] };
    return;
  }

  if (user.role === "admin") {
    if (query && query[doctorField]) {
      filter[doctorField] = query[doctorField];
    }
    return;
  }

  if (user.role === "doctor") {
    const doctor = await Doctor.findOne({ user: user._id })
      .select("_id")
      .lean();

    if (!doctor) {
      filter[doctorField] = { $in: [] };
      return;
    }

    const requestedDoctor = query?.[doctorField];
    filter[doctorField] =
      requestedDoctor && requestedDoctor !== doctor._id.toString()
        ? { $in: [] }
        : doctor._id;
    return;
  }

  if (user.role === "receptionist") {
    const authorizedDoctorIds = await getAuthorizedDoctorIds(user);

    if (!authorizedDoctorIds || !authorizedDoctorIds.length) {
      filter[doctorField] = { $in: [] };
      return;
    }

    const requestedDoctor = query?.[doctorField];
    if (requestedDoctor) {
      const isAllowed = authorizedDoctorIds.some(
        (id) => id.toString() === requestedDoctor.toString()
      );
      filter[doctorField] = isAllowed ? requestedDoctor : { $in: [] };
    } else {
      filter[doctorField] = { $in: authorizedDoctorIds };
    }
  }
};

module.exports = {
  getAuthorizedDoctorIds,
  isDoctorAuthorizedForUser,
  assertDoctorAccess,
  assertPatientAccess,
  applyClinicScope,
};
