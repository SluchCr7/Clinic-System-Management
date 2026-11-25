const Doctor = require("../modules/Doctor/doctor.model");
const DoctorAssignment = require("../modules/DoctorAssignment/doctorAssignment.model");

/**
 * Class representing the resolved authorization scope for queries.
 * Provides helper methods to automatically apply doctor/clinic boundary filters
 * across any MongoDB collection without code duplication.
 */
class SearchScope {
  constructor({ role, userId, doctorIds = null, isUnrestricted = false }) {
    this.role = role;
    this.userId = userId;
    this.doctorIds = doctorIds; // array of ObjectIds (or null if unrestricted)
    this.isUnrestricted = isUnrestricted; // true only for admin
  }

  /**
   * Whether the user has access to any workspace.
   * Admin always has access.
   * Doctor/Receptionist only have access if linked to at least one active doctor profile.
   */
  get hasAccess() {
    if (this.isUnrestricted) return true;
    return Array.isArray(this.doctorIds) && this.doctorIds.length > 0;
  }

  /**
   * Applies scope filter for collections that reference Doctor (e.g. Patient, Appointment, Visit, Invoice).
   * @param {Object} filter - The target MongoDB filter object.
   * @param {string} doctorField - Field name referencing Doctor (default: 'doctor').
   * @returns {Object} Modified filter object.
   */
  applyScope(filter = {}, doctorField = "doctor") {
    if (this.isUnrestricted) {
      return filter;
    }

    if (!this.hasAccess) {
      filter[doctorField] = { $in: [] };
      return filter;
    }

    filter[doctorField] = { $in: this.doctorIds };
    return filter;
  }

  /**
   * Applies scope filter specifically for the Doctor model where the identifier is `_id`.
   * @param {Object} filter - The target MongoDB filter object.
   * @returns {Object} Modified filter object.
   */
  applyDoctorModelScope(filter = {}) {
    return this.applyScope(filter, "_id");
  }

  /**
   * Only Admin users are authorized to discover/search receptionist and staff user accounts.
   * Doctors and Receptionists are strictly forbidden from viewing receptionist accounts.
   */
  canSearchReceptionists() {
    return this.isUnrestricted;
  }

  /**
   * Returns authorized doctor IDs list, or null if unrestricted (admin).
   */
  getAuthorizedDoctorIds() {
    return this.isUnrestricted ? null : this.doctorIds || [];
  }
}

/**
 * Resolves the query scope for the current authenticated user.
 * SECURITY: Derives role, user._id, and doctor associations solely from the authenticated
 * session and verified database records. Never trusts client-supplied query parameters or headers.
 *
 * @param {Object} user - The authenticated user object from req.user
 * @returns {Promise<SearchScope>}
 */
const resolveSearchScope = async (user) => {
  if (!user || !user.role) {
    return new SearchScope({
      role: "anonymous",
      userId: null,
      doctorIds: [],
      isUnrestricted: false,
    });
  }

  // 1. Admin: Unrestricted scope across the entire clinic
  if (user.role === "admin") {
    return new SearchScope({
      role: "admin",
      userId: user._id,
      doctorIds: null,
      isUnrestricted: true,
    });
  }

  // 2. Doctor: Scoped strictly to their own Doctor profile
  if (user.role === "doctor") {
    const doctor = await Doctor.findOne({
      user: user._id,
      isActive: true,
    })
      .select("_id")
      .lean();

    return new SearchScope({
      role: "doctor",
      userId: user._id,
      doctorIds: doctor ? [doctor._id] : [],
      isUnrestricted: false,
    });
  }

  // 3. Receptionist: Scoped strictly to doctors actively assigned via DoctorAssignment
  if (user.role === "receptionist") {
    const assignments = await DoctorAssignment.find({
      receptionist: user._id,
      isActive: true,
    })
      .select("doctor")
      .lean();

    const assignedDoctorIds = assignments
      .map((a) => a.doctor)
      .filter(Boolean);

    // Also check direct doctor reference on user if any
    if (user.doctor && !assignedDoctorIds.some((id) => id.toString() === user.doctor.toString())) {
      assignedDoctorIds.push(user.doctor);
    }

    if (!assignedDoctorIds.length) {
      return new SearchScope({
        role: "receptionist",
        userId: user._id,
        doctorIds: [],
        isUnrestricted: false,
      });
    }

    // Verify assigned doctors are currently active
    const activeDoctors = await Doctor.find({
      _id: { $in: assignedDoctorIds },
      isActive: true,
    })
      .select("_id")
      .lean();

    const activeDoctorIds = activeDoctors.map((doc) => doc._id);

    return new SearchScope({
      role: "receptionist",
      userId: user._id,
      doctorIds: activeDoctorIds,
      isUnrestricted: false,
    });
  }

  // Fallback for unknown role: Deny all access
  return new SearchScope({
    role: user.role,
    userId: user._id,
    doctorIds: [],
    isUnrestricted: false,
  });
};

module.exports = {
  SearchScope,
  resolveSearchScope,
};
