const MedicalAttachment = require("./medicalAttachment.model");

const Patient = require("../Patient/patient.model");
const Visit = require("../Visit/visit.model");
const Doctor = require("../Doctor/doctor.model");
const Appointment = require("../Appointment/appointment.model");

const { AppError } = require("../../middlewares/errorHandler");
const { validateFileSignature } = require("../../utils/validateFileSignature");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../utils/cloudinary");

const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const { getSearchRegex, getSort } = require("../../utils/listQuery");

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

const validateVisit = async (visitId, patientId) => {
  if (!visitId) return null;

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

  return visit;
};

// ---------------------------------------------
// Create Medical Attachment
// ---------------------------------------------

const createMedicalAttachment = async (
  data,
  file,
  currentUser
) => {
  if (!file) {
    throw new AppError(
      "Medical attachment file is required",
      400,
      "FILE_REQUIRED"
    );
  }

  validateFileSignature(file.buffer, ["image", "pdf"]);

  const {
    patient: patientId,
    visit: visitId,
    type,
    title,
    description,
  } = data;

  // -------------------------------------------
  // 1. Validate Patient
  // -------------------------------------------

  await validatePatient(patientId);

  // -------------------------------------------
  // 2. Validate Visit
  // -------------------------------------------

  await validateVisit(visitId, patientId);

  // -------------------------------------------
  // 3. Upload File To Cloudinary
  // -------------------------------------------

  const uploadedFile = await uploadToCloudinary(
    file.buffer,
    `clinic/medical-attachments/${patientId}`
  );

  try {
    // -----------------------------------------
    // 4. Create Database Record
    // -----------------------------------------

    const attachment =
      await MedicalAttachment.create({
        patient: patientId,
        visit: visitId || null,
        type,
        title,
        description: description || null,

        file: {
          url: uploadedFile.url,
          publicId: uploadedFile.publicId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },

        uploadedBy: currentUser._id,
      });

    // -----------------------------------------
    // 5. Audit Log
    // -----------------------------------------

    await auditLogService.logActivity({
      actor: currentUser,
      action: "MEDICAL_ATTACHMENT_UPLOADED",
      resource: "MedicalAttachment",
      resourceId: attachment._id,

      details: {
        patient: attachment.patient,
        visit: attachment.visit,
        type: attachment.type,
        title: attachment.title,

        file: {
          originalName: attachment.file.originalName,
          mimeType: attachment.file.mimeType,
          size: attachment.file.size,
        },
      },
    });

    return attachment;
  } catch (error) {
    // -----------------------------------------
    // Cleanup Cloudinary File
    // -----------------------------------------

    await deleteFromCloudinary(
      uploadedFile.publicId
    );

    throw error;
  }
};

// ---------------------------------------------
// Get Patient Attachments
// ---------------------------------------------

const getPatientAttachments = async (
  patientId,
  query = {},
  currentUser = null
) => {
  await validatePatient(patientId);

  const filter = {
    patient: patientId,
  };

  if (currentUser?.role === "doctor") {
    const doctor = await Doctor.findOne({
      user: currentUser._id,
    })
      .select("_id")
      .lean()
      .exec();
    const patientIds = doctor
      ? await Visit.distinct("patient", {
          doctor: doctor._id,
        })
      : [];
    const canAccessPatient = patientIds.some(
      (id) => id.toString() === patientId?.toString()
    );

    filter.patient = canAccessPatient
      ? patientId
      : { $in: [] };
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.visit) {
    filter.visit = query.visit;
  }

  const searchRegex = getSearchRegex(query.search);
  if (searchRegex) {
    filter.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { "file.originalName": searchRegex },
    ];
  }

  return paginateQuery(
    MedicalAttachment.find(filter)
      .populate(
        "patient",
        "firstName lastName phone"
      )
      .populate(
        "visit",
        "chiefComplaint diagnosis createdAt"
      )
      .populate(
        "uploadedBy",
        "firstName lastName email role"
      )
      .sort(
        getSort(
          query,
          ["createdAt", "updatedAt", "title", "type"],
          "createdAt"
        )
      ),
    MedicalAttachment.countDocuments(filter),
    query.page,
    query.limit
  );
};

// ---------------------------------------------
// Get Attachment By ID
// ---------------------------------------------

const getMedicalAttachmentById = async (id, currentUser = null) => {
  const attachment = await MedicalAttachment.findById(id)
    .populate(
      "patient",
      "firstName lastName phone email"
    )
    .populate(
      "visit",
      "chiefComplaint diagnosis doctorNotes createdAt"
    )
    .populate(
      "uploadedBy",
      "firstName lastName email role"
    );

  if (!attachment) {
    return null;
  }

  if (currentUser?.role === "doctor") {
    const doctor = await Doctor.findOne({
      user: currentUser._id,
    })
      .select("_id")
      .lean()
      .exec();

    if (!doctor) {
      throw new AppError("Access denied", 403, "FORBIDDEN");
    }

    const patientId = attachment.patient?._id || attachment.patient;
    const [hasAppointment, hasVisit] = await Promise.all([
      Appointment.exists({ doctor: doctor._id, patient: patientId }),
      Visit.exists({ doctor: doctor._id, patient: patientId }),
    ]);

    if (!hasAppointment && !hasVisit) {
      throw new AppError(
        "You are not authorized to view this patient's medical attachment",
        403,
        "FORBIDDEN"
      );
    }
  }

  return attachment;
};

// ---------------------------------------------
// Delete Medical Attachment
// ---------------------------------------------

const deleteMedicalAttachment = async (
  id,
  currentUser
) => {
  const attachment =
    await MedicalAttachment.findById(id);

  if (!attachment) {
    return null;
  }

  // -------------------------------------------
  // Save Data For Audit Before Delete
  // -------------------------------------------

  const auditDetails = {
    patient: attachment.patient,
    visit: attachment.visit,
    type: attachment.type,
    title: attachment.title,

    file: {
      originalName: attachment.file.originalName,
      mimeType: attachment.file.mimeType,
      size: attachment.file.size,
      publicId: attachment.file.publicId,
    },
  };

  // -------------------------------------------
  // Delete From Cloudinary First
  // -------------------------------------------

  await deleteFromCloudinary(
    attachment.file.publicId
  );

  // -------------------------------------------
  // Delete Database Record
  // -------------------------------------------

  await attachment.deleteOne();

  // -------------------------------------------
  // Audit Log
  // -------------------------------------------

  await auditLogService.logActivity({
    actor: currentUser,
    action: "MEDICAL_ATTACHMENT_DELETED",
    resource: "MedicalAttachment",
    resourceId: attachment._id,

    details: auditDetails,
  });

  return attachment;
};

module.exports = {
  createMedicalAttachment,
  getPatientAttachments,
  getMedicalAttachmentById,
  deleteMedicalAttachment,
};