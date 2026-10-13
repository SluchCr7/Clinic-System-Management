const PerformedService = require("./performedService.model");
const Visit = require("../Visit/visit.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");
const MedicalService = require("../medicalService/medicalService.model");
const Invoice = require("../Invoice/invoice.model");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const {
  getSearchRegex,
  getSort,
  applyCairoDateRange,
  applyDoctorScope,
  getDoctorScopeId,
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

  return visit;
};

const validateMedicalService = async (serviceId) => {
  const medicalService = await MedicalService.findById(serviceId);

  if (!medicalService) {
    throw new AppError(
      "Medical service not found",
      404,
      "MEDICAL_SERVICE_NOT_FOUND"
    );
  }

  if (!medicalService.isActive) {
    throw new AppError(
      "Medical service is inactive",
      400,
      "MEDICAL_SERVICE_INACTIVE"
    );
  }

  return medicalService;
};

const validateDiscount = (price, quantity, discount) => {
  const total = price * quantity;

  if (discount > total) {
    throw new AppError(
      "Discount cannot exceed the total service price",
      400,
      "INVALID_DISCOUNT"
    );
  }
};

const createPerformedService = async (data, currentUser) => {
  const {
    visit,
    patient,
    doctor,
    service,
    quantity = 1,
    discount = 0,
    notes,
    performedAt,
  } = data;

  if (currentUser?.role === "doctor") {
    const doctorId = await getDoctorScopeId(currentUser, Doctor);
    if (!doctorId || doctorId.toString() !== doctor.toString()) {
      throw new AppError(
        "Doctors can only create performed services for their own visits",
        403,
        "FORBIDDEN"
      );
    }
  }

  const [patientData, doctorData, visitData, medicalService, existingInvoice] = await Promise.all([
    validatePatient(patient),
    validateDoctor(doctor),
    validateVisit(visit, patient, doctor),
    validateMedicalService(service),
    Invoice.findOne({ visit, status: { $ne: "cancelled" } }),
  ]);

  if (existingInvoice) {
    throw new AppError(
      "Cannot add performed services to an already invoiced visit",
      400,
      "VISIT_ALREADY_INVOICED"
    );
  }

  void patientData;
  void doctorData;

  validateDiscount(medicalService.price, quantity, discount);

  if (performedAt && new Date(performedAt) > new Date() && process.env.NODE_ENV === "production") {
    throw new AppError(
      "Performed service date cannot be in the future",
      400,
      "INVALID_PERFORMED_DATE"
    );
  }

  const performedService = await PerformedService.create({
    visit: visitData._id,
    patient: visitData.patient,
    doctor: visitData.doctor,
    service: medicalService._id,
    serviceName: medicalService.name,
    serviceCode: medicalService.code,
    price: medicalService.price,
    quantity,
    discount,
    notes,
    performedAt,
    createdBy: currentUser._id,
  });

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "PERFORMED_SERVICE_CREATED",
      resource: "PerformedService",
      resourceId: performedService._id,
      details: {
        visit: performedService.visit,
        patient: performedService.patient,
        doctor: performedService.doctor,
        service: performedService.service,
        serviceName: performedService.serviceName,
        serviceCode: performedService.serviceCode,
        price: performedService.price,
        quantity: performedService.quantity,
        discount: performedService.discount,
        performedAt: performedService.performedAt,
      },
    });
  }

  return performedService;
};

const getPerformedServices = async (query = {}, currentUser = null) => {
  const filter = {};

  if (query.visit) filter.visit = query.visit;
  if (query.patient) filter.patient = query.patient;
  if (query.doctor) filter.doctor = query.doctor;
  if (query.service) filter.service = query.service;

  const searchRegex = getSearchRegex(query.search);
  if (searchRegex) {
    filter.$or = [
      { serviceName: searchRegex },
      { serviceCode: searchRegex },
    ];
  }

  applyCairoDateRange(filter, "performedAt", query);
  await applyDoctorScope(filter, query, currentUser, Doctor);

  return paginateQuery(
    PerformedService.find(filter)
      .populate("patient", "firstName lastName phone email dateOfBirth gender bloodType")
      .populate({
        path: "doctor",
        select: "user specialization licenseNumber profilePhoto",
        populate: {
          path: "user",
          select: "firstName lastName email phone",
        },
      })
      .populate("service", "name code description category price duration")
      .populate({
        path: "visit",
        select: "chiefComplaint diagnosis followUpDate createdAt",
      })
      .sort(
        getSort(
          query,
          [
            "performedAt",
            "serviceName",
            "serviceCode",
            "price",
            "createdAt",
            "updatedAt",
          ],
          "performedAt"
        )
      ),
    PerformedService.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getPerformedServiceById = async (id, currentUser = null) => {
  const filter = { _id: id };
  if (currentUser?.role === "doctor") {
    const doctorId = await getDoctorScopeId(currentUser, Doctor);
    if (!doctorId) return null;
    filter.doctor = doctorId;
  }

  return await PerformedService.findOne(filter)
    .populate("patient", "firstName lastName phone email dateOfBirth gender bloodType")
    .populate({
      path: "doctor",
      select: "user specialization licenseNumber profilePhoto",
      populate: {
        path: "user",
        select: "firstName lastName email phone",
      },
    })
    .populate("service", "name code description category price duration")
    .populate({
      path: "visit",
      select: "chiefComplaint diagnosis followUpDate createdAt",
    });
};

const updatePerformedService = async (id, data, currentUser) => {
  const filter = { _id: id };
  if (currentUser?.role === "doctor") {
    const doctorId = await getDoctorScopeId(currentUser, Doctor);
    if (!doctorId) return null;
    filter.doctor = doctorId;
  }

  const performedService = await PerformedService.findOne(filter);

  if (!performedService) {
    return null;
  }

  const existingInvoice = await Invoice.findOne({
    visit: performedService.visit,
    status: { $ne: "cancelled" },
  });

  if (existingInvoice) {
    throw new AppError(
      "Cannot modify billable services after an invoice has been generated",
      400,
      "SERVICE_ALREADY_INVOICED"
    );
  }

  const previousValues = {
    price: performedService.price,
    quantity: performedService.quantity,
    discount: performedService.discount,
    service: performedService.service,
  };

  const quantity = data.quantity !== undefined ? data.quantity : performedService.quantity;
  const discount = data.discount !== undefined ? data.discount : performedService.discount;

  validateDiscount(performedService.price, quantity, discount);

  if (data.performedAt && new Date(data.performedAt) > new Date() && process.env.NODE_ENV === "production") {
    throw new AppError(
      "Performed service date cannot be in the future",
      400,
      "INVALID_PERFORMED_DATE"
    );
  }

  if (data.quantity !== undefined) performedService.quantity = data.quantity;
  if (data.discount !== undefined) performedService.discount = data.discount;
  if (data.notes !== undefined) performedService.notes = data.notes;
  if (data.performedAt !== undefined) performedService.performedAt = data.performedAt;

  performedService.updatedBy = currentUser._id;
  await performedService.save();

  const newValues = {
    price: performedService.price,
    quantity: performedService.quantity,
    discount: performedService.discount,
    service: performedService.service,
  };

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "PERFORMED_SERVICE_UPDATED",
      resource: "PerformedService",
      resourceId: performedService._id,
      details: {
        previousValues,
        newValues,
      },
    });
  }

  return performedService;
};

module.exports = {
  createPerformedService,
  getPerformedServices,
  getPerformedServiceById,
  updatePerformedService,
};