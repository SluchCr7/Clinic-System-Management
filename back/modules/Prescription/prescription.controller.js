const asyncHandler = require("express-async-handler");

const prescriptionService = require("./prescription.service");
const { AppError } = require("../../middlewares/errorHandler");

const createPrescription = asyncHandler(
  async (req, res) => {
    const prescription =
      await prescriptionService.createPrescription(
        req.body,
        req.user
      );

    res.status(201).json({
      success: true,
      message:
        "Prescription created successfully",
      data: prescription,
    });
  }
);

const getPrescriptions = asyncHandler(
  async (req, res) => {
    const { data: prescriptions, pagination } =
      await prescriptionService.getPrescriptions(
        req.validatedQuery,
        req.user
      );

    res.status(200).json({
      success: true,
      data: prescriptions,
      pagination,
    });
  }
);

const getPrescriptionById = asyncHandler(
  async (req, res) => {
    const prescription =
      await prescriptionService.getPrescriptionById(
        req.params.id,
        req.user
      );

    if (!prescription) {
      throw new AppError(
        "Prescription not found",
        404,
        "PRESCRIPTION_NOT_FOUND"
      );
    }

    res.status(200).json({
      success: true,
      data: prescription,
    });
  }
);

const updatePrescription = asyncHandler(
  async (req, res) => {
    const prescription =
      await prescriptionService.updatePrescription(
        req.params.id,
        req.body,
        req.user
      );

    if (!prescription) {
      throw new AppError(
        "Prescription not found",
        404,
        "PRESCRIPTION_NOT_FOUND"
      );
    }

    res.status(200).json({
      success: true,
      message:
        "Prescription updated successfully",
      data: prescription,
    });
  }
);

module.exports = {
  createPrescription,
  getPrescriptions,
  getPrescriptionById,
  updatePrescription,
};