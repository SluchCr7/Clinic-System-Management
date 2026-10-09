const asyncHandler = require("express-async-handler");

const medicalServiceService = require("./medicalService.service");
const { AppError } = require("../../middlewares/errorHandler");

const createMedicalService = asyncHandler(
  async (req, res) => {
    const medicalService =
      await medicalServiceService.createMedicalService(
        req.body,
        req.user
      );

    res.status(201).json({
      success: true,
      message:
        "Medical service created successfully",
      data: medicalService,
    });
  }
);

const getMedicalServices = asyncHandler(
  async (req, res) => {
    const { data: medicalServices, pagination } =
      await medicalServiceService.getMedicalServices(
        req.validatedQuery
      );

    res.status(200).json({
      success: true,
      data: medicalServices,
      pagination,
    });
  }
);

const getMedicalServiceById =
  asyncHandler(async (req, res) => {
    const medicalService =
      await medicalServiceService.getMedicalServiceById(
        req.params.id
      );

    if (!medicalService) {
      throw new AppError(
        "Medical service not found",
        404,
        "MEDICAL_SERVICE_NOT_FOUND"
      );
    }

    res.status(200).json({
      success: true,
      data: medicalService,
    });
  });

const updateMedicalService =
  asyncHandler(async (req, res) => {
    const medicalService =
      await medicalServiceService.updateMedicalService(
        req.params.id,
        req.body,
        req.user
      );

    if (!medicalService) {
      throw new AppError(
        "Medical service not found",
        404,
        "MEDICAL_SERVICE_NOT_FOUND"
      );
    }

    res.status(200).json({
      success: true,
      message:
        "Medical service updated successfully",
      data: medicalService,
    });
  });

const deactivateMedicalService =
  asyncHandler(async (req, res) => {
    const medicalService =
      await medicalServiceService.deactivateMedicalService(
        req.params.id,
        req.user
      );

    if (!medicalService) {
      throw new AppError(
        "Medical service not found",
        404,
        "MEDICAL_SERVICE_NOT_FOUND"
      );
    }

    res.status(200).json({
      success: true,
      message:
        "Medical service deactivated successfully",
      data: medicalService,
    });
  });

module.exports = {
  createMedicalService,
  getMedicalServices,
  getMedicalServiceById,
  updateMedicalService,
  deactivateMedicalService,
};