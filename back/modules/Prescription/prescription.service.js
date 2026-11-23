const Prescription = require("./prescription.model");
const Visit = require("../Visit/visit.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");
const LabOrder = require("../LabOrder/labOrder.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const { getSort } = require("../../utils/listQuery");
const { assertVisitInProgress } = require("../../utils/visitLifecycle");
const {
  assertDoctorAccess,
  applyClinicScope,
} = require("../../utils/accessControl");

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

const validateVisit = async (visitId, patientId, doctorId) => {
  const visit = await Visit.findById(visitId);

  if (!visit) {
    throw new AppError(
      "Visit not found",
      404,
      "VISIT_NOT_FOUND"
    );
  }

  if (visit.patient.toString() !== patientId) {
    throw new AppError(
      "Visit does not belong to this patient",
      400,
      "VISIT_PATIENT_MISMATCH"
    );
  }

  if (visit.doctor.toString() !== doctorId) {
    throw new AppError(
      "Visit does not belong to this doctor",
      400,
      "VISIT_DOCTOR_MISMATCH"
    );
  }

  return assertVisitInProgress(visit);
};

const createPrescription = async (data, currentUser) => {
  const { visit, patient, doctor } = data;

  if (!currentUser || currentUser.role !== "doctor") {
    throw new AppError(
      "Only doctors have permission to create prescriptions",
      403,
      "FORBIDDEN"
    );
  }

  const doctorRecord = await Doctor.findOne({ user: currentUser._id, isActive: true })
    .select("_id")
    .lean()
    .exec();

  if (!doctorRecord || doctorRecord._id.toString() !== doctor.toString()) {
    throw new AppError(
      "Doctors can only create prescriptions for themselves",
      403,
      "FORBIDDEN"
    );
  }

  const patientRecord = await validatePatient(patient);
  if (patientRecord.doctor && patientRecord.doctor.toString() !== doctor.toString()) {
    throw new AppError(
      "Patient does not belong to this doctor's clinic",
      400,
      "PATIENT_DOCTOR_MISMATCH"
    );
  }

  await validateDoctor(doctor);
  await validateVisit(visit, patient, doctor);

  if (!data.medications?.length) {
    const referralCount = await LabOrder.countDocuments({
      visit,
      status: { $ne: "CANCELLED" },
    });
    if (referralCount === 0) {
      throw new AppError(
        "A prescription requires at least one medication or external referral",
        422,
        "PRESCRIPTION_CONTENT_REQUIRED"
      );
    }
  }

  const existingPrescription = await Prescription.findOne({ visit });

  if (existingPrescription) {
    throw new AppError(
      "A prescription already exists for this visit",
      409,
      "PRESCRIPTION_ALREADY_EXISTS"
    );
  }

  const prescription = await Prescription.create({
    ...data,
    createdBy: currentUser._id,
  });

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "PRESCRIPTION_CREATED",
      resource: "Prescription",
      resourceId: prescription._id,
      details: {
        visit: prescription.visit,
        patient: prescription.patient,
        doctor: prescription.doctor,
        medicationCount: prescription.medications?.length || 0,
      },
    });
  }

  return prescription;
};

const getPrescriptions = async (query = {}, currentUser = null) => {
  const filter = {};

  if (query.patient) filter.patient = query.patient;
  if (query.doctor) filter.doctor = query.doctor;
  if (query.visit) filter.visit = query.visit;
  await applyClinicScope(filter, query, currentUser, "doctor");

  return paginateQuery(
    Prescription.find(filter)
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
        path: "visit",
        select: "chiefComplaint symptoms diagnosis doctorNotes followUpDate createdAt",
      })
      .sort(
        getSort(query, ["createdAt", "updatedAt"], "createdAt")
      ),
    Prescription.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getPrescriptionById = async (id, currentUser = null) => {
  const prescription = await Prescription.findById(id)
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
      path: "visit",
      select: "chiefComplaint symptoms diagnosis doctorNotes followUpDate createdAt",
    });

  if (!prescription) {
    return null;
  }

  const liveLabOrders = await LabOrder.find({
    visit: prescription.visit,
  })
    .populate("doctor", "user specialization")
    .populate("requestedBy", "firstName lastName")
    .sort({ createdAt: -1 });
  prescription._doc.labOrders = liveLabOrders;

  if (currentUser) {
    await assertDoctorAccess(
      currentUser,
      prescription.doctor?._id || prescription.doctor
    );
  }

  return prescription;
};

const updatePrescription = async (id, data, currentUser) => {
  const prescription = await Prescription.findById(id);

  if (!prescription) {
    return null;
  }

  if (!currentUser || currentUser.role !== "doctor") {
    throw new AppError(
      "Only doctors have permission to update prescriptions",
      403,
      "FORBIDDEN"
    );
  }

  const doctor = await Doctor.findOne({
    user: currentUser._id,
    isActive: true,
  })
    .select("_id")
    .lean()
    .exec();

  if (!doctor || doctor._id.toString() !== prescription.doctor.toString()) {
    throw new AppError(
      "You are not authorized to update this prescription",
      403,
      "FORBIDDEN"
    );
  }

  const previousMedicationCount = prescription.medications?.length || 0;

  Object.assign(prescription, data);
  if (!prescription.medications?.length) {
    const referralCount = await LabOrder.countDocuments({
      visit: prescription.visit,
      status: { $ne: "CANCELLED" },
    });
    if (referralCount === 0) {
      throw new AppError(
        "A prescription requires at least one medication or external referral",
        422,
        "PRESCRIPTION_CONTENT_REQUIRED"
      );
    }
  }
  prescription.updatedBy = currentUser._id;

  await prescription.save();

  const newMedicationCount = prescription.medications?.length || 0;

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "PRESCRIPTION_UPDATED",
      resource: "Prescription",
      resourceId: prescription._id,
      details: {
        previousMedicationCount,
        newMedicationCount,
      },
    });
  }

  return prescription;
};

module.exports = {
  createPrescription,
  getPrescriptions,
  getPrescriptionById,
  updatePrescription,
};
