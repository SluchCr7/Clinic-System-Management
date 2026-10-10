const LabOrder = require("./labOrder.model");

const Visit = require("../Visit/visit.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");

const { AppError } = require("../../middlewares/errorHandler");

const { paginateQuery } = require("../../utils/pagination");
const {
  getSearchRegex,
  getSort,
  applyCairoDateRange,
  applyDoctorScope,
  getDoctorScopeId,
} = require("../../utils/listQuery");

// ---------------------------------------------
// Helpers
// ---------------------------------------------

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

const validateVisit = async (
  visitId,
  patientId,
  doctorId
) => {
  const visit = await Visit.findById(visitId);

  if (!visit) {
    throw new AppError(
      "Visit not found",
      404,
      "VISIT_NOT_FOUND"
    );
  }

  if (
    visit.patient.toString() !==
    patientId.toString()
  ) {
    throw new AppError(
      "Visit does not belong to this patient",
      400,
      "VISIT_PATIENT_MISMATCH"
    );
  }

  if (
    visit.doctor.toString() !==
    doctorId.toString()
  ) {
    throw new AppError(
      "Visit does not belong to this doctor",
      400,
      "VISIT_DOCTOR_MISMATCH"
    );
  }

  return visit;
};

const validateTests = (tests) => {
  if (!tests || tests.length === 0) {
    throw new AppError(
      "Lab order must contain at least one test",
      400,
      "LAB_TESTS_REQUIRED"
    );
  }

  const normalizedCodes = tests
    .filter((test) => test.code)
    .map((test) => test.code.toUpperCase());

  const uniqueCodes = new Set(normalizedCodes);

  if (
    uniqueCodes.size !==
    normalizedCodes.length
  ) {
    throw new AppError(
      "Duplicate lab tests are not allowed",
      400,
      "DUPLICATE_LAB_TEST"
    );
  }
};

// ---------------------------------------------
// Create Lab Order
// ---------------------------------------------

const createLabOrder = async (
  data,
  currentUser
) => {
  const {
    visit,
    patient,
    doctor,
    tests,
    reason,
    priority,
    notes,
    orderedAt,
  } = data;

  if (currentUser?.role === "doctor") {
    const doctorId = await getDoctorScopeId(currentUser, Doctor);
    if (!doctorId || doctorId.toString() !== doctor.toString()) {
      throw new AppError(
        "Doctors can only create lab orders for their own visits",
        403,
        "FORBIDDEN"
      );
    }
  }

  await Promise.all([
    validatePatient(patient),
    validateDoctor(doctor),
  ]);

  await validateVisit(
    visit,
    patient,
    doctor
  );

  validateTests(tests);

  if (
    orderedAt &&
    new Date(orderedAt) > new Date()
  ) {
    throw new AppError(
      "Lab order date cannot be in the future",
      400,
      "INVALID_ORDER_DATE"
    );
  }

  const labOrder = await LabOrder.create({
    visit,
    patient,
    doctor,
    tests,
    reason,
    priority,
    notes,
    orderedAt,
    createdBy: currentUser._id,
  });

  // -------------------------------------------
  // Audit Log
  // -------------------------------------------

  await auditLogService.logActivity({
    actor: currentUser,
    action: "LAB_ORDER_CREATED",
    resource: "LabOrder",
    resourceId: labOrder._id,

    details: {
      visit: labOrder.visit,
      patient: labOrder.patient,
      doctor: labOrder.doctor,

      tests: labOrder.tests,

      reason: labOrder.reason,
      priority: labOrder.priority,
      notes: labOrder.notes,

      status: labOrder.status,
      orderedAt: labOrder.orderedAt,
    },
  });

  return labOrder;
};

// ---------------------------------------------
// Get Lab Orders
// ---------------------------------------------

const getLabOrders = async (query = {}, currentUser = null) => {
  const filter = {};

  if (query.visit) {
    filter.visit = query.visit;
  }

  if (query.patient) {
    filter.patient = query.patient;
  }

  if (query.doctor) {
    filter.doctor = query.doctor;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.priority) {
    filter.priority = query.priority;
  }

  const searchRegex = getSearchRegex(query.search);
  if (searchRegex) {
    filter.$or = [
      { reason: searchRegex },
      { "tests.name": searchRegex },
      { "tests.code": searchRegex },
    ];
  }

  applyCairoDateRange(filter, "orderedAt", query);
  await applyDoctorScope(filter, query, currentUser, Doctor);

  return paginateQuery(
    LabOrder.find(filter)
      .populate(
        "patient",
        "firstName lastName phone email dateOfBirth gender bloodType"
      )
      .populate({
        path: "doctor",
        select:
          "user specialization licenseNumber profilePhoto",
        populate: {
          path: "user",
          select:
            "firstName lastName email phone",
        },
      })
      .populate(
        "visit",
        "chiefComplaint diagnosis doctorNotes createdAt"
      )
      .populate(
        "createdBy",
        "firstName lastName email role"
      )
      .populate(
        "updatedBy",
        "firstName lastName email role"
      )
      .sort(
        getSort(
          query,
          [
            "orderedAt",
            "priority",
            "status",
            "createdAt",
            "updatedAt",
          ],
          "orderedAt"
        )
      ),
    LabOrder.countDocuments(filter),
    query.page,
    query.limit
  );
};

// ---------------------------------------------
// Get Lab Order By ID
// ---------------------------------------------

const getLabOrderById = async (id, currentUser = null) => {
  const filter = { _id: id };
  if (currentUser?.role === "doctor") {
    const doctorId = await getDoctorScopeId(currentUser, Doctor);
    if (!doctorId) return null;
    filter.doctor = doctorId;
  }

  return await LabOrder.findOne(filter)
    .populate(
      "patient",
      "firstName lastName phone email dateOfBirth gender bloodType"
    )
    .populate({
      path: "doctor",
      select:
        "user specialization licenseNumber profilePhoto",
      populate: {
        path: "user",
        select:
          "firstName lastName email phone",
      },
    })
    .populate(
      "visit",
      "chiefComplaint diagnosis doctorNotes createdAt"
    )
    .populate(
      "createdBy",
      "firstName lastName email role"
    )
    .populate(
      "updatedBy",
      "firstName lastName email role"
    );
};

// ---------------------------------------------
// Update Lab Order
// ---------------------------------------------

const updateLabOrder = async (
  id,
  data,
  currentUser
) => {
  const filter = { _id: id };
  if (currentUser?.role === "doctor") {
    const doctorId = await getDoctorScopeId(currentUser, Doctor);
    if (!doctorId) return null;
    filter.doctor = doctorId;
  }

  const labOrder =
    await LabOrder.findOne(filter);

  if (!labOrder) {
    return null;
  }

  // -------------------------------------------
  // Prevent modification of finalized orders
  // -------------------------------------------

  if (
    ["completed", "cancelled"].includes(
      labOrder.status
    )
  ) {
    throw new AppError(
      "Completed or cancelled lab orders cannot be modified",
      400,
      "LAB_ORDER_LOCKED"
    );
  }

  // -------------------------------------------
  // Save Previous Values For Audit
  // -------------------------------------------

  const previousValues = {
    tests: labOrder.tests,
    reason: labOrder.reason,
    priority: labOrder.priority,
    notes: labOrder.notes,
    orderedAt: labOrder.orderedAt,
    status: labOrder.status,
  };

  // -------------------------------------------
  // Tests
  // -------------------------------------------

  if (data.tests !== undefined) {
    validateTests(data.tests);

    labOrder.tests = data.tests;
  }

  // -------------------------------------------
  // Basic Fields
  // -------------------------------------------

  if (data.reason !== undefined) {
    labOrder.reason = data.reason;
  }

  if (data.priority !== undefined) {
    labOrder.priority = data.priority;
  }

  if (data.notes !== undefined) {
    labOrder.notes = data.notes;
  }

  if (data.orderedAt !== undefined) {
    if (
      new Date(data.orderedAt) > new Date()
    ) {
      throw new AppError(
        "Lab order date cannot be in the future",
        400,
        "INVALID_ORDER_DATE"
      );
    }

    labOrder.orderedAt = data.orderedAt;
  }

  // -------------------------------------------
  // Status Transition Rules
  // -------------------------------------------

  if (data.status !== undefined) {
    const currentStatus =
      labOrder.status;

    const newStatus =
      data.status;

    const allowedTransitions = {
      ordered: [
        "sample_collected",
        "cancelled",
      ],

      sample_collected: [
        "processing",
        "cancelled",
      ],

      processing: [
        "completed",
        "cancelled",
      ],

      completed: [],

      cancelled: [],
    };

    const allowed =
      allowedTransitions[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Invalid lab order status transition from ${currentStatus} to ${newStatus}`,
        400,
        "INVALID_STATUS_TRANSITION"
      );
    }

    labOrder.status = newStatus;
  }

  labOrder.updatedBy =
    currentUser._id;

  await labOrder.save();

  // -------------------------------------------
  // Audit Log
  // -------------------------------------------

  await auditLogService.logActivity({
    actor: currentUser,
    action: "LAB_ORDER_UPDATED",
    resource: "LabOrder",
    resourceId: labOrder._id,

    details: {
      previousValues,

      newValues: {
        tests: labOrder.tests,
        reason: labOrder.reason,
        priority: labOrder.priority,
        notes: labOrder.notes,
        orderedAt: labOrder.orderedAt,
        status: labOrder.status,
      },

      statusChanged:
        previousValues.status !==
        labOrder.status,
    },
  });

  return labOrder;
};

module.exports = {
  createLabOrder,
  getLabOrders,
  getLabOrderById,
  updateLabOrder,
};