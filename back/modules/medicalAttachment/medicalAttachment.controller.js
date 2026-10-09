const asyncHandler = require("express-async-handler");

const medicalAttachmentService = require("./medicalAttachment.service");

const {AppError} = require("../../middlewares/errorHandler");

// ---------------------------------------------
// Create Medical Attachment
// ---------------------------------------------

const createMedicalAttachment = asyncHandler(
  async (req, res) => {
    const attachment =
      await medicalAttachmentService.createMedicalAttachment(
        req.body,
        req.file,
        req.user
      );

    res.status(201).json({
      success: true,
      message:
        "Medical attachment uploaded successfully",
      data: attachment,
    });
  }
);

// ---------------------------------------------
// Get Patient Attachments
// ---------------------------------------------

const getPatientAttachments = asyncHandler(
  async (req, res) => {
    const { data: attachments, pagination } =
      await medicalAttachmentService.getPatientAttachments(
        req.validatedQuery.patient,
        req.validatedQuery,
        req.user
      );

    res.status(200).json({
      success: true,
      data: attachments,
      pagination,
    });
  }
);

// ---------------------------------------------
// Get Attachment By ID
// ---------------------------------------------

const getMedicalAttachmentById = asyncHandler(
  async (req, res) => {
    const attachment =
      await medicalAttachmentService.getMedicalAttachmentById(
        req.params.id,
        req.user
      );

    if (!attachment) {
      throw new AppError(
        "Medical attachment not found",
        404,
        "ATTACHMENT_NOT_FOUND"
      );
    }

    res.status(200).json({
      success: true,
      data: attachment,
    });
  }
);

// ---------------------------------------------
// Delete Medical Attachment
// ---------------------------------------------

const deleteMedicalAttachment = asyncHandler(
  async (req, res) => {
    const attachment =
      await medicalAttachmentService.deleteMedicalAttachment(
        req.params.id,
        req.user
      );

    if (!attachment) {
      throw new AppError(
        "Medical attachment not found",
        404,
        "ATTACHMENT_NOT_FOUND"
      );
    }

    res.status(200).json({
      success: true,
      message:
        "Medical attachment deleted successfully",
    });
  }
);

module.exports = {
  createMedicalAttachment,
  getPatientAttachments,
  getMedicalAttachmentById,
  deleteMedicalAttachment,
};