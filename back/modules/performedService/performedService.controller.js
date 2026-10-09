const asyncHandler = require("express-async-handler");
const performedServiceService = require("./performedService.service");
const { AppError } = require("../../middlewares/errorHandler");

const createPerformedService = asyncHandler(async (req, res) => {
  const performedService =
    await performedServiceService.createPerformedService(
      req.body,
      req.user
    );

  res.status(201).json({
    success: true,
    message: "Performed service created successfully",
    data: performedService,
  });
});

const getPerformedServices = asyncHandler(async (req, res) => {
  const { data: performedServices, pagination } =
    await performedServiceService.getPerformedServices(
      req.validatedQuery,
      req.user
    );

  res.status(200).json({
    success: true,
    data: performedServices,
    pagination,
  });
});

const getPerformedServiceById = asyncHandler(async (req, res) => {
  const performedService =
    await performedServiceService.getPerformedServiceById(
      req.params.id
    );

  if (!performedService) {
    throw new AppError(
      "Performed service not found",
      404,
      "PERFORMED_SERVICE_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    data: performedService,
  });
});

const updatePerformedService = asyncHandler(async (req, res) => {
  const performedService =
    await performedServiceService.updatePerformedService(
      req.params.id,
      req.body,
      req.user
    );

  if (!performedService) {
    throw new AppError(
      "Performed service not found",
      404,
      "PERFORMED_SERVICE_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Performed service updated successfully",
    data: performedService,
  });
});

module.exports = {
  createPerformedService,
  getPerformedServices,
  getPerformedServiceById,
  updatePerformedService,
};