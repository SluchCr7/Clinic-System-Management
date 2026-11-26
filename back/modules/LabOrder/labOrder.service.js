const LabOrder = require("./labOrder.model");
const Visit = require("../Visit/visit.model");
const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");
const DoctorAssignment = require("../DoctorAssignment/doctorAssignment.model");
const auditLogService = require("../AuditLog/auditLog.service");
const { AppError } = require("../../middlewares/errorHandler");
const { saveInspectedFile } = require("../../middlewares/labResultUpload");
const fs = require("fs");
const mongoose = require("mongoose");

// ---------------------------------------------
// Clinic Isolation & Role Helpers
// ---------------------------------------------

/**
 * Resolves clinicId strictly from user token / session profile.
 * - Admin: 403 (No access to medical orders)
 * - Doctor: Doctor's clinic
 * - Receptionist: Assigned doctor's clinic
 */
const resolveUserClinicId = async (user) => {
  if (!user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }

  if (user.role === "admin") {
    throw new AppError(
      "Admin has no access to medical order data",
      403,
      "FORBIDDEN"
    );
  }

  if (user.clinic) {
    return new mongoose.Types.ObjectId(user.clinic);
  }

  if (user.role === "doctor") {
    const doctor = await Doctor.findOne({ user: user._id, isActive: true })
      .select("clinic _id")
      .lean();
    if (doctor?.clinic) {
      return new mongoose.Types.ObjectId(doctor.clinic);
    }
  }

  if (user.role === "receptionist") {
    const assignment = await DoctorAssignment.findOne({
      receptionist: user._id,
      isActive: true,
    })
      .populate("doctor", "clinic")
      .lean();

    if (assignment?.clinic) {
      return new mongoose.Types.ObjectId(assignment.clinic);
    }
    if (assignment?.doctor?.clinic) {
      return new mongoose.Types.ObjectId(assignment.doctor.clinic);
    }
  }

  throw new AppError("Clinic not found for this user", 404, "CLINIC_NOT_FOUND");
};

const resolveDoctorProfile = async (user) => {
  if (!user || user.role !== "doctor") {
    throw new AppError(
      "Only doctors have permission to perform this action",
      403,
      "FORBIDDEN"
    );
  }
  const doctor = await Doctor.findOne({ user: user._id, isActive: true }).lean();
  if (!doctor) {
    throw new AppError("Doctor profile not found", 404, "DOCTOR_NOT_FOUND");
  }
  return doctor;
};

// ---------------------------------------------
// Validation Helpers
// ---------------------------------------------

const validatePatient = async (patientId, clinicId) => {
  const patient = await Patient.findById(patientId);
  if (!patient) {
    throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
  }
  if (!patient.isActive) {
    throw new AppError("Patient is inactive", 400, "PATIENT_INACTIVE");
  }
  return patient;
};

const validateVisit = async (visitId, patientId) => {
  const visit = await Visit.findById(visitId);
  if (!visit) {
    throw new AppError("Visit not found", 404, "VISIT_NOT_FOUND");
  }
  if (visit.patient.toString() !== patientId.toString()) {
    throw new AppError(
      "Visit does not belong to this patient",
      400,
      "VISIT_PATIENT_MISMATCH"
    );
  }
  return visit;
};

// ---------------------------------------------
// 1. Create Lab Order (Doctor Only)
// ---------------------------------------------

const createLabOrder = async (data, currentUser) => {
  if (!currentUser || currentUser.role !== "doctor") {
    throw new AppError(
      "Only doctors have permission to create lab orders",
      403,
      "FORBIDDEN"
    );
  }

  const doctor = await resolveDoctorProfile(currentUser);
  const clinicId = await resolveUserClinicId(currentUser);

  const patientId = data.patientId || data.patient;
  const visitId = data.visitId || data.visit;
  const prescriptionId = data.prescriptionId || null;

  await validatePatient(patientId, clinicId);
  await validateVisit(visitId, patientId);

  // Normalize items
  let rawItems = data.items;
  if (!rawItems || !rawItems.length) {
    if (data.tests && data.tests.length) {
      const defaultType =
        data.type === "IMAGING" || data.type === "radiology"
          ? "radiology"
          : "lab";
      rawItems = data.tests.map((t) => ({
        name: t.name,
        code: t.code,
        instructions: t.instructions,
        type: defaultType,
        status: "ordered",
      }));
    }
  }

  if (!rawItems || rawItems.length === 0) {
    throw new AppError(
      "Lab order must contain at least one lab or radiology item",
      400,
      "LAB_ITEMS_REQUIRED"
    );
  }

  const normalizedItems = rawItems.map((item) => ({
    name: item.name.trim(),
    type:
      item.type === "radiology" || item.type === "IMAGING"
        ? "radiology"
        : "lab",
    code: item.code || null,
    instructions: item.instructions || null,
    status: "ordered",
    labName: item.labName || null,
    resultNotes: item.resultNotes || null,
    statusHistory: [
      {
        from: null,
        to: "ordered",
        changedBy: currentUser._id,
        changedAt: new Date(),
        reason: "Initial order creation",
      },
    ],
  }));

  const priority =
    data.priority === "urgent" || data.priority === "stat"
      ? "urgent"
      : "routine";

  const labOrder = await LabOrder.create({
    clinicId,
    patientId,
    visitId,
    prescriptionId,
    orderedBy: currentUser._id,
    doctor: doctor._id,
    patient: patientId,
    visit: visitId,
    priority,
    type: normalizedItems.some((i) => i.type === "radiology")
      ? "IMAGING"
      : "LAB",
    status: "REQUESTED",
    items: normalizedItems,
    tests: normalizedItems.map((i) => ({
      name: i.name,
      code: i.code,
      instructions: i.instructions,
    })),
    reason: data.reason || null,
    notes: data.notes || null,
    orderedAt: data.orderedAt || new Date(),
    createdBy: currentUser._id,
  });

  await auditLogService.logActivity({
    actor: currentUser,
    action: "LAB_ORDER_CREATED",
    resource: "LabOrder",
    resourceId: labOrder._id,
    clinic: clinicId,
    details: {
      visitId,
      patientId,
      priority,
      itemsCount: normalizedItems.length,
    },
  });

  return labOrder;
};

// ---------------------------------------------
// 2. Grouped List Aggregation (Server-Side)
// ---------------------------------------------

const getGroupedLabOrders = async (queryParams, currentUser) => {
  const clinicId = await resolveUserClinicId(currentUser);

  const page = parseInt(queryParams.page, 10) || 1;
  const limit = parseInt(queryParams.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const filter = queryParams.filter || "pending"; // 'pending' (default) or 'all'
  const filterStatus = queryParams.status; // 'ordered', 'received', 'cancelled', 'all'
  const filterType = queryParams.type; // 'lab', 'radiology', 'all'
  const filterPriority = queryParams.priority; // 'routine', 'urgent', 'all'
  const search = (queryParams.search || "").trim();
  const startDate = queryParams.startDate || queryParams.date;
  const endDate = queryParams.endDate || queryParams.date;

  // Build match stage
  const matchStage = {
    clinicId: new mongoose.Types.ObjectId(clinicId),
  };

  if (filterPriority && filterPriority !== "all") {
    matchStage.priority = filterPriority === "stat" ? "urgent" : filterPriority;
  }

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      matchStage.createdAt.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt.$lte = end;
    }
  }

  // Pipeline stages
  const pipeline = [
    { $match: matchStage },

    // Lookup Patient
    {
      $lookup: {
        from: "patients",
        localField: "patientId",
        foreignField: "_id",
        as: "patientInfo",
      },
    },
    { $unwind: "$patientInfo" },

    // Lookup Visit
    {
      $lookup: {
        from: "visits",
        localField: "visitId",
        foreignField: "_id",
        as: "visitInfo",
      },
    },
    { $unwind: "$visitInfo" },

    // Add Computed Counts & Sorting Indicators
    {
      $addFields: {
        totalItemsCount: { $size: { $ifNull: ["$items", []] } },
        pendingCount: {
          $size: {
            $filter: {
              input: { $ifNull: ["$items", []] },
              as: "it",
              cond: {
                $in: ["$$it.status", ["ordered", "REQUESTED", "requested"]],
              },
            },
          },
        },
        receivedCount: {
          $size: {
            $filter: {
              input: { $ifNull: ["$items", []] },
              as: "it",
              cond: {
                $in: [
                  "$$it.status",
                  ["received", "RESULT_RECEIVED", "result_received"],
                ],
              },
            },
          },
        },
        cancelledCount: {
          $size: {
            $filter: {
              input: { $ifNull: ["$items", []] },
              as: "it",
              cond: {
                $in: ["$$it.status", ["cancelled", "CANCELLED"]],
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        hasPending: { $gt: ["$pendingCount", 0] },
        isUrgent: { $eq: ["$priority", "urgent"] },
      },
    },
  ];

  // Search filter by patient name or phone
  if (search) {
    const searchRegex = new RegExp(search, "i");
    pipeline.push({
      $match: {
        $or: [
          { "patientInfo.firstName": searchRegex },
          { "patientInfo.lastName": searchRegex },
          { "patientInfo.phone": searchRegex },
        ],
      },
    });
  }

  // Apply default Pending Only filter or status filters
  if (filter === "pending") {
    pipeline.push({ $match: { hasPending: true } });
  }

  if (filterStatus && filterStatus !== "all") {
    const statusVal =
      filterStatus === "REQUESTED"
        ? "ordered"
        : filterStatus === "RESULT_RECEIVED"
        ? "received"
        : filterStatus === "CANCELLED"
        ? "cancelled"
        : filterStatus;
    pipeline.push({
      $match: {
        "items.status": { $in: [statusVal, statusVal.toUpperCase()] },
      },
    });
  }

  if (filterType && filterType !== "all") {
    const typeVal = filterType.toLowerCase();
    pipeline.push({
      $match: {
        "items.type": { $in: [typeVal, typeVal === "radiology" ? "IMAGING" : "LAB"] },
      },
    });
  }

  // Sorting cards:
  // 1) Cards with pending items first
  // 2) Then urgent priority cards
  // 3) Then most recent visit / order date
  pipeline.push({
    $sort: {
      hasPending: -1,
      isUrgent: -1,
      createdAt: -1,
    },
  });

  // Facet for pagination
  pipeline.push({
    $facet: {
      metadata: [{ $count: "total" }],
      data: [{ $skip: skip }, { $limit: limit }],
    },
  });

  const [result] = await LabOrder.aggregate(pipeline);
  const total = result.metadata[0]?.total || 0;
  const rawCards = result.data || [];

  // Fixed item order inside each card:
  // 1) By status: ordered (pending) first, then received, then cancelled.
  // 2) Within each status: labs first, then radiology (consistent, never mixed).
  // 3) Alphabetical by item name.
  const statusRank = {
    ordered: 1,
    requested: 1,
    REQUESTED: 1,
    received: 2,
    result_received: 2,
    RESULT_RECEIVED: 2,
    cancelled: 3,
    CANCELLED: 3,
  };

  const formattedCards = rawCards.map((card) => {
    const items = (card.items || []).slice().sort((a, b) => {
      const rankA = statusRank[a.status] || 99;
      const rankB = statusRank[b.status] || 99;
      if (rankA !== rankB) return rankA - rankB;

      // Labs first, then radiology
      const isLabA = a.type === "lab" || a.type === "LAB" ? 0 : 1;
      const isLabB = b.type === "lab" || b.type === "LAB" ? 0 : 1;
      if (isLabA !== isLabB) return isLabA - isLabB;

      // Alphabetical
      return (a.name || "").localeCompare(b.name || "", "ar");
    });

    return {
      _id: card._id,
      clinicId: card.clinicId,
      visitId: card.visitId,
      patientId: card.patientId,
      prescriptionId: card.prescriptionId,
      priority: card.priority,
      createdAt: card.createdAt,
      patient: {
        _id: card.patientInfo._id,
        firstName: card.patientInfo.firstName,
        lastName: card.patientInfo.lastName,
        phone: card.patientInfo.phone,
        gender: card.patientInfo.gender,
        dateOfBirth: card.patientInfo.dateOfBirth,
      },
      visit: {
        _id: card.visitInfo._id,
        status: card.visitInfo.status,
        createdAt: card.visitInfo.createdAt,
        appointmentDate: card.visitInfo.appointmentDate,
        chiefComplaint: card.visitInfo.chiefComplaint,
      },
      counts: {
        total: card.totalItemsCount || items.length,
        pending: card.pendingCount,
        received: card.receivedCount,
        cancelled: card.cancelledCount,
      },
      hasPending: card.hasPending,
      items,
    };
  });

  return {
    data: formattedCards,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

// ---------------------------------------------
// 3. Update Lab Order Item Status (Doctor Only)
// ---------------------------------------------

const updateLabOrderItem = async (itemId, updateData, files, currentUser) => {
  if (!currentUser || currentUser.role !== "doctor") {
    throw new AppError(
      "Only doctors have permission to update lab and radiology orders",
      403,
      "FORBIDDEN"
    );
  }

  const userClinicId = await resolveUserClinicId(currentUser);

  // Check if item belongs to this clinic
  const order = await LabOrder.findOne({
    "items._id": itemId,
    clinicId: userClinicId,
  });

  if (!order) {
    // Check if it belongs to another clinic (must return 404 per requirements)
    const existsOtherClinic = await LabOrder.findOne({ "items._id": itemId });
    if (existsOtherClinic) {
      throw new AppError("Lab order item not found", 404, "LAB_ORDER_ITEM_NOT_FOUND");
    }
    throw new AppError("Lab order item not found", 404, "LAB_ORDER_ITEM_NOT_FOUND");
  }

  const item = order.items.id(itemId);
  if (!item) {
    throw new AppError("Lab order item not found", 404, "LAB_ORDER_ITEM_NOT_FOUND");
  }

  const oldStatus = item.status;
  const newStatus = updateData.status
    ? updateData.status === "REQUESTED"
      ? "ordered"
      : updateData.status === "RESULT_RECEIVED"
      ? "received"
      : updateData.status === "CANCELLED"
      ? "cancelled"
      : updateData.status
    : oldStatus;

  // Status transitions
  if (newStatus !== oldStatus) {
    item.status = newStatus;
    if (newStatus === "received") {
      item.receivedAt = updateData.receivedAt || new Date();
    } else if (newStatus === "ordered") {
      // Reverting from received back to ordered is allowed
      item.receivedAt = null;
    }

    if (newStatus === "cancelled" && updateData.cancelReason) {
      item.cancelReason = updateData.cancelReason;
    }

    item.statusHistory.push({
      from: oldStatus,
      to: newStatus,
      changedBy: currentUser._id,
      changedAt: new Date(),
      reason: updateData.cancelReason || updateData.reason || null,
    });

    // Audit log entry
    await auditLogService.logActivity({
      actor: currentUser,
      action: "LAB_ORDER_ITEM_STATUS_CHANGED",
      resource: "LabOrderItem",
      resourceId: item._id,
      clinic: userClinicId,
      details: {
        orderId: order._id,
        itemId: item._id,
        itemName: item.name,
        fromStatus: oldStatus,
        toStatus: newStatus,
        cancelReason: updateData.cancelReason || null,
      },
    });
  }

  if (updateData.labName !== undefined) {
    item.labName = updateData.labName?.trim() || null;
  }
  if (updateData.resultNotes !== undefined) {
    item.resultNotes = updateData.resultNotes?.trim() || null;
  }
  if (updateData.cancelReason !== undefined && newStatus === "cancelled") {
    item.cancelReason = updateData.cancelReason?.trim() || null;
  }

  // Handle uploaded files
  if (files && files.length > 0) {
    for (const file of files) {
      const saved = await saveInspectedFile(file);
      item.resultFiles.push(saved);
    }
  }

  item.updatedBy = currentUser._id;
  await order.save();

  return {
    item,
    orderId: order._id,
  };
};

// ---------------------------------------------
// 4. File Management & Secure Serving
// ---------------------------------------------

const deleteLabOrderItemFile = async (itemId, fileId, currentUser) => {
  if (!currentUser || currentUser.role !== "doctor") {
    throw new AppError(
      "Only doctors have permission to delete result files",
      403,
      "FORBIDDEN"
    );
  }

  const userClinicId = await resolveUserClinicId(currentUser);

  const order = await LabOrder.findOne({
    "items._id": itemId,
    clinicId: userClinicId,
  });

  if (!order) {
    throw new AppError("Lab order item not found", 404, "LAB_ORDER_ITEM_NOT_FOUND");
  }

  const item = order.items.id(itemId);
  const fileSubdoc = item.resultFiles.id(fileId);
  if (!fileSubdoc) {
    throw new AppError("Result file not found", 404, "FILE_NOT_FOUND");
  }

  // Delete physical file from disk
  if (fs.existsSync(fileSubdoc.path)) {
    try {
      await fs.promises.unlink(fileSubdoc.path);
    } catch {
      // Ignore disk delete errors
    }
  }

  fileSubdoc.deleteOne();
  await order.save();

  return { success: true };
};

const getLabResultFileRecord = async (itemId, fileId, currentUser) => {
  const userClinicId = await resolveUserClinicId(currentUser);

  const order = await LabOrder.findOne({
    "items._id": itemId,
    clinicId: userClinicId,
  });

  if (!order) {
    throw new AppError("Lab order item not found", 404, "LAB_ORDER_ITEM_NOT_FOUND");
  }

  const item = order.items.id(itemId);
  const fileRecord = item.resultFiles.id(fileId);
  if (!fileRecord) {
    throw new AppError("Result file not found", 404, "FILE_NOT_FOUND");
  }

  if (!fs.existsSync(fileRecord.path)) {
    throw new AppError("File does not exist on disk", 404, "FILE_NOT_FOUND");
  }

  return fileRecord;
};

// ---------------------------------------------
// 5. Follow-Up Visit: Pending Orders for Patient
// ---------------------------------------------

const getPendingOrdersByPatient = async (patientId, currentUser, currentVisitId = null) => {
  const clinicId = await resolveUserClinicId(currentUser);

  const matchFilter = {
    clinicId: new mongoose.Types.ObjectId(clinicId),
    patientId: new mongoose.Types.ObjectId(patientId),
    "items.status": { $in: ["ordered", "REQUESTED", "requested"] },
  };

  // Exclude current visit's new orders if specified to show "previous orders awaiting results"
  if (currentVisitId) {
    matchFilter.visitId = { $ne: new mongoose.Types.ObjectId(currentVisitId) };
  }

  const orders = await LabOrder.find(matchFilter)
    .populate("visitId", "createdAt status appointmentDate")
    .sort({ createdAt: -1 })
    .lean();

  const pendingItems = [];
  for (const order of orders) {
    for (const item of order.items || []) {
      if (["ordered", "REQUESTED", "requested"].includes(item.status)) {
        pendingItems.push({
          orderId: order._id,
          itemId: item._id,
          type: item.type,
          name: item.name,
          code: item.code,
          priority: order.priority,
          orderedAt: order.createdAt,
          visitId: order.visitId?._id || order.visitId,
          visitDate: order.visitId?.createdAt || order.createdAt,
          labName: item.labName,
          resultNotes: item.resultNotes,
        });
      }
    }
  }

  return pendingItems;
};

// ---------------------------------------------
// 6. Backward Compatibility Methods
// ---------------------------------------------

const getLabOrders = async (queryParams, currentUser) => {
  // Can delegate to getGroupedLabOrders or return flat list
  return getGroupedLabOrders(queryParams, currentUser);
};

const getLabOrderById = async (id, currentUser) => {
  const clinicId = await resolveUserClinicId(currentUser);
  const order = await LabOrder.findOne({
    _id: id,
    clinicId,
  })
    .populate("patientId", "firstName lastName phone")
    .populate("visitId", "createdAt status");

  if (!order) {
    const existsOther = await LabOrder.findById(id);
    if (existsOther) {
      throw new AppError("Lab order not found", 404, "LAB_ORDER_NOT_FOUND");
    }
    throw new AppError("Lab order not found", 404, "LAB_ORDER_NOT_FOUND");
  }

  return order;
};

const updateLabOrder = async (id, data, currentUser) => {
  // Compatibility method for existing tests/calls
  if (currentUser.role !== "doctor") {
    throw new AppError("Only doctors can update lab orders", 403, "FORBIDDEN");
  }
  const clinicId = await resolveUserClinicId(currentUser);
  const order = await LabOrder.findOne({ _id: id, clinicId });
  if (!order) {
    throw new AppError("Lab order not found", 404, "LAB_ORDER_NOT_FOUND");
  }

  if (data.status) {
    order.status = data.status;
    const mapped =
      data.status === "RESULT_RECEIVED"
        ? "received"
        : data.status === "CANCELLED"
        ? "cancelled"
        : "ordered";
    for (const it of order.items) {
      it.status = mapped;
      if (mapped === "received") it.receivedAt = data.receivedAt || new Date();
    }
  }
  if (data.receivedAt) order.receivedAt = data.receivedAt;
  await order.save();

  await auditLogService.logActivity({
    actor: currentUser,
    action: "LAB_ORDER_UPDATED",
    resource: "LabOrder",
    resourceId: order._id,
    clinic: clinicId,
  });

  return order;
};

module.exports = {
  resolveUserClinicId,
  createLabOrder,
  getGroupedLabOrders,
  updateLabOrderItem,
  deleteLabOrderItemFile,
  getLabResultFileRecord,
  getPendingOrdersByPatient,
  getLabOrders,
  getLabOrderById,
  updateLabOrder,
};
