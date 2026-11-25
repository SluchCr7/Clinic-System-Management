const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");
const User = require("../User/user.model");
const Appointment = require("../Appointment/appointment.model");
const Invoice = require("../Invoice/invoice.model");
const MedicalService = require("../medicalService/medicalService.model");
const Visit = require("../Visit/visit.model");
const { resolveSearchScope } = require("../../utils/searchScope");

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseSearchDateRange = (q) => {
  const trimmed = q.trim();
  // Support YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, DD/MM/YYYY
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const start = new Date(parsed);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(parsed);
      end.setUTCHours(23, 59, 59, 999);
      return { $gte: start, $lte: end };
    }
  }
  return null;
};

const toResult = ({
  type,
  id,
  title,
  subtitle = "",
  status = null,
  date = null,
}) => ({
  type,
  id: String(id),
  title,
  subtitle,
  ...(status ? { status } : {}),
  ...(date ? { date } : {}),
});

const doctorDisplayName = (doctor) => {
  const user = doctor?.user;
  return user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";
};

/**
 * Executes RBAC-scoped global search across all clinic resources.
 * Guarantees zero information leakage for out-of-scope resources.
 *
 * @param {Object} params - { q, limit }
 * @param {Object} currentUser - req.user from authenticated session
 * @returns {Promise<Object>} Formatted search results
 */
const globalSearch = async ({ q, limit = 5 }, currentUser) => {
  const trimmedQuery = q.trim();
  const regex = new RegExp(escapeRegex(trimmedQuery), "i");
  const dateRange = parseSearchDateRange(trimmedQuery);

  // 1. Resolve authorization scope strictly from session & DB
  const scope = await resolveSearchScope(currentUser);

  // If user has no active doctor access (e.g. unassigned receptionist or inactive doctor profile)
  // return empty result directly without leaking any records.
  if (!scope.hasAccess) {
    return {
      query: q,
      results: {
        patients: [],
        doctors: [],
        receptionists: [],
        appointments: [],
        visits: [],
        invoices: [],
        services: [],
      },
      total: 0,
    };
  }

  // 2. Doctor user resolution for name search
  // If restricted, only consider doctor accounts within authorizedDoctorIds
  const doctorUserFilter = {
    role: "doctor",
    isActive: true,
    $or: [{ firstName: regex }, { lastName: regex }, { email: regex }, { phone: regex }],
  };

  const matchingDoctorUsers = await User.find(doctorUserFilter)
    .select("_id firstName lastName")
    .limit(50)
    .lean();

  const matchingDoctorUserIds = matchingDoctorUsers.map((user) => user._id);

  // 3. Prepare filters with automatic role-based scope enforcement

  // -- PATIENTS --
  const patientFilter = {
    isActive: true,
    $or: [
      { firstName: regex },
      { lastName: regex },
      { phone: regex },
      { email: regex },
    ],
  };
  scope.applyScope(patientFilter, "doctor");

  // -- DOCTORS --
  const doctorOrConditions = [
    { specialization: regex },
    { licenseNumber: regex },
    ...(matchingDoctorUserIds.length ? [{ user: { $in: matchingDoctorUserIds } }] : []),
  ];
  const doctorFilter = {
    isActive: true,
    $or: doctorOrConditions,
  };
  scope.applyDoctorModelScope(doctorFilter);

  // -- RECEPTIONISTS (Staff) --
  // Admin only! Doctors and Receptionists are strictly forbidden from discovering receptionist accounts.
  let receptionistPromise = Promise.resolve([]);
  if (scope.canSearchReceptionists()) {
    receptionistPromise = User.find({
      role: "receptionist",
      isActive: true,
      $or: [
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
        { email: regex },
      ],
    })
      .select("_id firstName lastName email phone")
      .sort({ firstName: 1, lastName: 1 })
      .limit(limit)
      .lean();
  }

  // Execute primary queries in parallel
  const [patients, doctors, receptionists, services] = await Promise.all([
    Patient.find(patientFilter)
      .select("_id firstName lastName phone email")
      .sort({ firstName: 1, lastName: 1 })
      .limit(limit)
      .lean(),
    Doctor.find(doctorFilter)
      .populate("user", "firstName lastName")
      .select("_id user specialization licenseNumber")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    receptionistPromise,
    MedicalService.find({
      isActive: true,
      $or: [
        { name: regex },
        { code: regex },
        { category: regex },
      ],
    })
      .select("_id name code category price")
      .sort({ name: 1 })
      .limit(limit)
      .lean(),
  ]);

  const matchingPatientIds = patients.map((p) => p._id);
  const matchingDoctorIds = doctors.map((d) => d._id);

  // -- APPOINTMENTS --
  const appointmentOr = [
    { reason: regex },
    { status: regex },
    ...(dateRange ? [{ appointmentDate: dateRange }] : []),
    ...(matchingPatientIds.length ? [{ patient: { $in: matchingPatientIds } }] : []),
    ...(matchingDoctorIds.length ? [{ doctor: { $in: matchingDoctorIds } }] : []),
  ];
  const appointmentFilter = { $or: appointmentOr };
  scope.applyScope(appointmentFilter, "doctor");

  // -- VISITS (Medical Records & Consultations) --
  const visitOr = [
    { chiefComplaint: regex },
    { examination: regex },
    { doctorNotes: regex },
    { diagnosis: regex },
    ...(dateRange ? [{ startedAt: dateRange }, { createdAt: dateRange }] : []),
    ...(matchingPatientIds.length ? [{ patient: { $in: matchingPatientIds } }] : []),
    ...(matchingDoctorIds.length ? [{ doctor: { $in: matchingDoctorIds } }] : []),
  ];
  const visitFilter = { $or: visitOr };
  scope.applyScope(visitFilter, "doctor");

  // -- INVOICES --
  const invoiceOr = [
    { invoiceNumber: regex },
    { status: regex },
    ...(dateRange ? [{ issuedAt: dateRange }, { createdAt: dateRange }] : []),
    ...(matchingPatientIds.length ? [{ patient: { $in: matchingPatientIds } }] : []),
    ...(matchingDoctorIds.length ? [{ doctor: { $in: matchingDoctorIds } }] : []),
  ];
  const invoiceFilter = { $or: invoiceOr };
  scope.applyScope(invoiceFilter, "doctor");

  // Execute secondary queries in parallel
  const [appointments, visits, invoices] = await Promise.all([
    Appointment.find(appointmentFilter)
      .populate("patient", "firstName lastName phone")
      .populate({
        path: "doctor",
        select: "specialization user",
        populate: { path: "user", select: "firstName lastName" },
      })
      .select("_id patient doctor appointmentDate status reason")
      .sort({ appointmentDate: -1 })
      .limit(limit)
      .lean(),
    Visit.find(visitFilter)
      .populate("patient", "firstName lastName")
      .populate({
        path: "doctor",
        select: "specialization user",
        populate: { path: "user", select: "firstName lastName" },
      })
      .select("_id patient doctor chiefComplaint diagnosis status startedAt createdAt")
      .sort({ startedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean(),
    Invoice.find(invoiceFilter)
      .populate("patient", "firstName lastName")
      .select("_id invoiceNumber patient total status issuedAt")
      .sort({ issuedAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  // 4. Format outputs into clean, unified result items
  const resultGroups = {
    patients: patients.map((patient) =>
      toResult({
        type: "patient",
        id: patient._id,
        title: `${patient.firstName} ${patient.lastName}`,
        subtitle: patient.phone || patient.email || "Patient",
      })
    ),
    doctors: doctors.map((doctor) =>
      toResult({
        type: "doctor",
        id: doctor._id,
        title: `د. ${doctorDisplayName(doctor)}`.trim(),
        subtitle: `${doctor.specialization} · ترخيص: ${doctor.licenseNumber}`,
      })
    ),
    receptionists: receptionists.map((rec) =>
      toResult({
        type: "receptionist",
        id: rec._id,
        title: `${rec.firstName} ${rec.lastName}`,
        subtitle: `موظف استقبال · هاتف: ${rec.phone || "غير محدد"}`,
      })
    ),
    appointments: appointments.map((appointment) =>
      toResult({
        type: "appointment",
        id: appointment._id,
        title: appointment.patient
          ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
          : "Appointment",
        subtitle: appointment.doctor
          ? `د. ${doctorDisplayName(appointment.doctor)} · ${appointment.doctor.specialization}`
          : appointment.reason || "Appointment",
        status: appointment.status,
        date: appointment.appointmentDate,
      })
    ),
    visits: visits.map((visit) =>
      toResult({
        type: "visit",
        id: visit._id,
        title: visit.patient
          ? `${visit.patient.firstName} ${visit.patient.lastName}`
          : "زيارة طبية",
        subtitle: `شكوى: ${visit.chiefComplaint || "فحص طبي"}${
          visit.diagnosis && visit.diagnosis.length ? ` · تشخيص: ${visit.diagnosis.join(", ")}` : ""
        }`,
        status: visit.status,
        date: visit.startedAt || visit.createdAt,
      })
    ),
    invoices: invoices.map((invoice) =>
      toResult({
        type: "invoice",
        id: invoice._id,
        title: invoice.invoiceNumber,
        subtitle: invoice.patient
          ? `${invoice.patient.firstName} ${invoice.patient.lastName} · إجمالي: ${invoice.total}`
          : `فاتورة · إجمالي: ${invoice.total}`,
        status: invoice.status,
        date: invoice.issuedAt,
      })
    ),
    services: services.map((service) =>
      toResult({
        type: "service",
        id: service._id,
        title: service.name,
        subtitle: `${service.code} · ${service.category}`,
      })
    ),
  };

  const total = Object.values(resultGroups).reduce(
    (sum, group) => sum + group.length,
    0
  );

  return {
    query: q,
    results: resultGroups,
    total,
  };
};

module.exports = { globalSearch };
