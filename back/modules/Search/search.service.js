const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");
const User = require("../User/user.model");
const Appointment = require("../Appointment/appointment.model");
const Invoice = require("../Invoice/invoice.model");
const MedicalService = require("../medicalService/medicalService.model");
const Visit = require("../Visit/visit.model");

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const globalSearch = async ({ q, limit = 5 }, currentUser) => {
  const regex = new RegExp(escapeRegex(q.trim()), "i");

  // Search only active staff accounts when resolving doctor names.
  const matchingDoctorUsers = await User.find({
    role: "doctor",
    isActive: true,
    $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
  })
    .select("_id firstName lastName")
    .limit(50)
    .lean();

  const matchingDoctorUserIds = matchingDoctorUsers.map((user) => user._id);
  const doctorName = (doctor) => {
    const user = doctor?.user;
    return user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";
  };

  let currentDoctor = null;
  let allowedPatientIds = null;

  if (currentUser.role === "doctor") {
    currentDoctor = await Doctor.findOne({
      user: currentUser._id,
      isActive: true,
    })
      .select("_id")
      .lean();

    if (!currentDoctor) {
      return {
        query: q,
        results: {
          patients: [],
          doctors: [],
          appointments: [],
          invoices: [],
          services: [],
        },
        total: 0,
      };
    }

    const [appointmentPatientIds, visitPatientIds] = await Promise.all([
      Appointment.distinct("patient", { doctor: currentDoctor._id }),
      Visit.distinct("patient", { doctor: currentDoctor._id }),
    ]);

    allowedPatientIds = [
      ...new Set(
        [...appointmentPatientIds, ...visitPatientIds].map(String)
      ),
    ];
  }

  const patientFilter = {
    isActive: true,
    $or: [
      { firstName: regex },
      { lastName: regex },
      { phone: regex },
      { email: regex },
    ],
  };

  if (allowedPatientIds) {
    patientFilter._id = { $in: allowedPatientIds };
  }

  const doctorFilter = {
    isActive: true,
    $or: [
      { specialization: regex },
      { licenseNumber: regex },
      ...(matchingDoctorUserIds.length
        ? [{ user: { $in: matchingDoctorUserIds } }]
        : []),
    ],
  };

  const [patients, doctors, services] = await Promise.all([
    Patient.find(patientFilter)
      .select("_id firstName lastName phone")
      .sort({ firstName: 1, lastName: 1 })
      .limit(limit)
      .lean(),
    Doctor.find(doctorFilter)
      .populate("user", "firstName lastName")
      .select("_id user specialization licenseNumber")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    MedicalService.find({
      isActive: true,
      $or: [
        { name: regex },
        { code: regex },
        { category: regex },
      ],
    })
      .select("_id name code category")
      .sort({ name: 1 })
      .limit(limit)
      .lean(),
  ]);

  const matchingPatientIds = patients.map((patient) => patient._id);
  const matchingDoctorIds = doctors.map((doctor) => doctor._id);

  const appointmentOr = [
    { reason: regex },
    ...(matchingPatientIds.length
      ? [{ patient: { $in: matchingPatientIds } }]
      : []),
    ...(matchingDoctorIds.length
      ? [{ doctor: { $in: matchingDoctorIds } }]
      : []),
  ];

  const appointmentFilter = { $or: appointmentOr };
  if (currentUser.role === "doctor") {
    appointmentFilter.doctor = currentDoctor._id;
  }

  const invoiceOr = [
    { invoiceNumber: regex },
    ...(matchingPatientIds.length
      ? [{ patient: { $in: matchingPatientIds } }]
      : []),
    ...(matchingDoctorIds.length
      ? [{ doctor: { $in: matchingDoctorIds } }]
      : []),
  ];

  const invoiceFilter = { $or: invoiceOr };
  if (currentUser.role === "doctor") {
    invoiceFilter.doctor = currentDoctor._id;
  }

  const [appointments, invoices] = await Promise.all([
    Appointment.find(appointmentFilter)
      .populate("patient", "firstName lastName")
      .populate({
        path: "doctor",
        select: "specialization user",
        populate: { path: "user", select: "firstName lastName" },
      })
      .select("_id patient doctor appointmentDate status reason")
      .sort({ appointmentDate: -1 })
      .limit(limit)
      .lean(),
    Invoice.find(invoiceFilter)
      .populate("patient", "firstName lastName")
      .select("_id invoiceNumber patient total status issuedAt")
      .sort({ issuedAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const resultGroups = {
    patients: patients.map((patient) =>
      toResult({
        type: "patient",
        id: patient._id,
        title: `${patient.firstName} ${patient.lastName}`,
        subtitle: patient.phone || "Patient",
      })
    ),
    doctors: doctors.map((doctor) =>
      toResult({
        type: "doctor",
        id: doctor._id,
        title: doctorName(doctor),
        subtitle: doctor.specialization,
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
          ? `Dr. ${doctorName(appointment.doctor)} · ${appointment.doctor.specialization}`
          : appointment.reason || "Appointment",
        status: appointment.status,
        date: appointment.appointmentDate,
      })
    ),
    invoices: invoices.map((invoice) =>
      toResult({
        type: "invoice",
        id: invoice._id,
        title: invoice.invoiceNumber,
        subtitle: invoice.patient
          ? `${invoice.patient.firstName} ${invoice.patient.lastName}`
          : "Invoice",
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
