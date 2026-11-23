const LabOrder = require("./labOrder.model");

const Visit = require("../Visit/visit.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");
const auditLogService = require("../AuditLog/auditLog.service");
const {
  applyClinicScope,
  assertPatientAccess,
  getAuthorizedReceptionistIds,
} = require("../../utils/accessControl");

const { AppError } = require("../../middlewares/errorHandler");
const Notification = require("../Notification/notification.model");
const { getIO } = require("../../utils/socket");
const { assertVisitInProgress } = require("../../utils/visitLifecycle");

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

  return assertVisitInProgress(visit);
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
  if (!currentUser || currentUser.role !== "doctor") {
    throw new AppError(
      "Only doctors have permission to create lab orders",
      403,
      "FORBIDDEN"
    );
  }

  const {
    type,
    visit,
    patient,
    doctor,
    tests,
    reason,
    priority,
    notes,
    orderedAt,
    instructions,
    clinicalNotes,
    expectedBy,
  } = data;

  const doctorId = await getDoctorScopeId(currentUser, Doctor);
  if (!doctorId || doctorId.toString() !== doctor.toString()) {
    throw new AppError(
      "Doctors can only create lab orders for their own visits",
      403,
      "FORBIDDEN"
    );
  }

  const [patientRecord] = await Promise.all([
    validatePatient(patient),
    validateDoctor(doctor),
  ]);

  if (patientRecord.doctor && patientRecord.doctor.toString() !== doctor.toString()) {
    throw new AppError(
      "Patient does not belong to this doctor's clinic",
      400,
      "PATIENT_DOCTOR_MISMATCH"
    );
  }

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
    type: type || "LAB",
    visit,
    patient,
    doctor,
    tests,
    reason,
    priority,
    notes,
    orderedAt,
    requestedAt: orderedAt || new Date(),
    requestedBy: currentUser._id,
    instructions,
    clinicalNotes,
    expectedBy,
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
      type: labOrder.type,
      instructions: labOrder.instructions,
      clinicalNotes: labOrder.clinicalNotes,
      expectedBy: labOrder.expectedBy,

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

  if (query.type) {
    filter.type = query.type;
  }

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
  await applyClinicScope(filter, query, currentUser, "doctor");

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
  const labOrder = await LabOrder.findOne(filter)
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
    .populate(
      "resultAttachment",
      "title description file type patient visit uploadedBy"
    );

  if (!labOrder) return null;
  await assertPatientAccess(currentUser, labOrder.patient);
  return labOrder;
};

// ---------------------------------------------
// Update Lab Order
// ---------------------------------------------

const updateLabOrder = async (
  id,
  data,
  currentUser
) => {
  if (!currentUser || !["admin", "doctor", "receptionist"].includes(currentUser.role)) {
    throw new AppError(
      "You do not have permission to update lab orders",
      403,
      "FORBIDDEN"
    );
  }

  const filter = { _id: id };

  const labOrder =
    await LabOrder.findOne(filter);

  if (!labOrder) {
    return null;
  }
  const patientRecord = await Patient.findById(labOrder.patient);
  await assertPatientAccess(currentUser, patientRecord);

  // -------------------------------------------
  // Save Previous Values For Audit
  // -------------------------------------------

  const previousValues = {
    tests: labOrder.tests,
    reason: labOrder.reason,
    priority: labOrder.priority,
    notes: labOrder.notes,
    orderedAt: labOrder.orderedAt,
    type: labOrder.type,
    instructions: labOrder.instructions,
    clinicalNotes: labOrder.clinicalNotes,
    expectedBy: labOrder.expectedBy,
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

  if (data.type !== undefined) {
    if (labOrder.status !== "REQUESTED") {
      throw new AppError("Referral type can only be changed while requested", 409, "LAB_ORDER_LOCKED");
    }
    labOrder.type = data.type;
  }

  if (data.instructions !== undefined) labOrder.instructions = data.instructions;
  if (data.clinicalNotes !== undefined) labOrder.clinicalNotes = data.clinicalNotes;
  if (data.expectedBy !== undefined) labOrder.expectedBy = data.expectedBy;
  if (data.receivedAt !== undefined) labOrder.receivedAt = data.receivedAt;
  if (data.performedAt !== undefined) labOrder.performedAt = data.performedAt;
  if (data.externalFacilityName !== undefined) labOrder.externalFacilityName = data.externalFacilityName;
  if (data.resultNotes !== undefined) labOrder.resultNotes = data.resultNotes;
  if (data.resultAttachment !== undefined) labOrder.resultAttachment = data.resultAttachment;

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
    const currentStatus = labOrder.status;
    const newStatus = data.status;
    let allowed = false;

    if (currentStatus === "REQUESTED") {
      allowed =
        newStatus === "RESULT_RECEIVED" ||
        newStatus === "CANCELLED";
    } else if (currentStatus === "RESULT_RECEIVED") {
      allowed =
        newStatus === "REQUESTED" &&
        ["admin", "doctor"].includes(currentUser.role);
    } else if (currentStatus === "CANCELLED") {
      allowed =
        newStatus === "REQUESTED" &&
        currentUser.role === "admin";
    }

    if (!allowed) {
      throw new AppError(
        `Invalid lab order status transition from ${currentStatus} to ${newStatus}`,
        409,
        "INVALID_STATUS_TRANSITION"
      );
    }

    if (newStatus === "CANCELLED" && !data.statusChangeReason) {
      throw new AppError(
        "A reason is required when cancelling an external referral",
        422,
        "STATUS_REASON_REQUIRED"
      );
    }

    if (
      currentStatus === "RESULT_RECEIVED" &&
      newStatus === "REQUESTED" &&
      !data.statusChangeReason
    ) {
      throw new AppError(
        "A reason is required when reopening a received result",
        422,
        "STATUS_REASON_REQUIRED"
      );
    }

    if (
      newStatus === "RESULT_RECEIVED" &&
      ["doctor", "receptionist", "admin"].includes(currentUser.role)
    ) {
      if (!data.receivedAt) data.receivedAt = new Date();
      labOrder.receivedBy = currentUser._id;
      labOrder.receivedAt = data.receivedAt;
      if (data.performedAt !== undefined) labOrder.performedAt = data.performedAt;
      if (data.externalFacilityName !== undefined) {
        labOrder.externalFacilityName = data.externalFacilityName;
      }
      if (data.resultNotes !== undefined) labOrder.resultNotes = data.resultNotes;
      if (data.resultAttachment !== undefined) {
        labOrder.resultAttachment = data.resultAttachment;
      }
    }

    if (newStatus === "CANCELLED" && currentUser.role !== "doctor" && currentUser.role !== "admin") {
      throw new AppError(
        "Only the doctor or administrator may cancel an external referral",
        403,
        "FORBIDDEN"
      );
    }

    labOrder.status = newStatus;
    labOrder.statusChangeReason =
      data.statusChangeReason || labOrder.statusChangeReason || null;
    labOrder.updatedBy = currentUser._id;
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
        type: labOrder.type,
        instructions: labOrder.instructions,
        clinicalNotes: labOrder.clinicalNotes,
        expectedBy: labOrder.expectedBy,
        receivedAt: labOrder.receivedAt,
        performedAt: labOrder.performedAt,
        externalFacilityName: labOrder.externalFacilityName,
        resultNotes: labOrder.resultNotes,
        resultAttachment: labOrder.resultAttachment,
        status: labOrder.status,
        statusChangeReason: labOrder.statusChangeReason,
      },

      statusChanged:
        previousValues.status !==
        labOrder.status,
    },
  });

  if (
    previousValues.status !== "RESULT_RECEIVED" &&
    labOrder.status === "RESULT_RECEIVED" &&
    currentUser.role === "receptionist"
  ) {
    const doctor = await Doctor.findById(labOrder.doctor)
      .populate("user", "_id firstName lastName")
      .lean();
    const recipientId = doctor?.user?._id;
    if (
      recipientId &&
      recipientId.toString() !== currentUser._id.toString()
    ) {
      const testName =
        labOrder.tests?.map((test) => test.name).join("، ") ||
        "الطلب الخارجي";
      const eventKey =
        `lab-result:${labOrder._id}:${recipientId}`;
      const notification = await Notification.findOneAndUpdate(
        { eventKey },
        {
          $setOnInsert: {
            recipient: recipientId,
            type: "lab_result",
            title: "وصلت نتيجة طلب خارجي",
            message:
              `وصلت نتيجة ${testName} للمريض ${patientRecord.firstName} ${patientRecord.lastName}`,
            relatedModel: "LabOrder",
            relatedId: labOrder._id,
            eventKey,
            createdBy: currentUser._id,
            actor: currentUser._id,
            entityType: "LabOrder",
            entityId: labOrder._id,
            link: `/lab-orders`,
            priority: "medium",
          },
        },
        { upsert: true, new: true }
      );
      try {
        getIO().to(`user:${recipientId}`).emit("notification:new", {
          notification,
        });
      } catch {
        // Persisted notification is sufficient if realtime is unavailable.
      }
    }
  }

  if (
    previousValues.status !== "CANCELLED" &&
    labOrder.status === "CANCELLED" &&
    currentUser.role === "doctor"
  ) {
    const receptionistIds = await getAuthorizedReceptionistIds(labOrder.doctor);
    const testName =
      labOrder.tests?.map((test) => test.name).join("، ") ||
      "الطلب الخارجي";
    for (const receptionistId of receptionistIds) {
      const eventKey =
        `lab-cancelled:${labOrder._id}:${receptionistId}`;
      const notification = await Notification.findOneAndUpdate(
        { eventKey },
        {
          $setOnInsert: {
            recipient: receptionistId,
            type: "lab_cancelled",
            title: "تم إلغاء طلب خارجي",
            message:
              `أُلغي طلب ${testName} للمريض ${patientRecord.firstName} ${patientRecord.lastName}`,
            relatedModel: "LabOrder",
            relatedId: labOrder._id,
            eventKey,
            createdBy: currentUser._id,
            actor: currentUser._id,
            entityType: "LabOrder",
            entityId: labOrder._id,
            link: `/lab-orders`,
            priority: "low",
          },
        },
        { upsert: true, new: true }
      );
      try {
        getIO().to(`user:${receptionistId}`).emit("notification:new", {
          notification,
        });
      } catch {
        // Persisted notification is sufficient if realtime is unavailable.
      }
    }
  }

  return labOrder;
};

module.exports = {
  createLabOrder,
  getLabOrders,
  getLabOrderById,
  updateLabOrder,
};