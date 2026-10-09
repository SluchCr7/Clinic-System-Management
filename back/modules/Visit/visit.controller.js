const asyncHandler = require("express-async-handler");

const visitService = require("./visit.service");
const { AppError } = require("../../middlewares/errorHandler");

const createVisit = asyncHandler(async (req, res) => {
  const visit = await visitService.createVisit(
    req.body,
    req.user
  );

  res.status(201).json({
    success: true,
    message: "Visit created successfully",
    data: visit,
  });
});

const getVisits = asyncHandler(async (req, res) => {
  const { data: visits, pagination } = await visitService.getVisits(
    req.validatedQuery,
    req.user
  );

  res.status(200).json({
    success: true,
    data: visits,
    pagination,
  });
});

const getVisitById = asyncHandler(async (req, res) => {
  const visit = await visitService.getVisitById(
    req.params.id,
    req.user
  );

  if (!visit) {
    throw new AppError(
      "Visit not found",
      404,
      "VISIT_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    data: visit,
  });
});

const updateVisit = asyncHandler(async (req, res) => {
  const visit = await visitService.updateVisit(
    req.params.id,
    req.body,
    req.user
  );

  if (!visit) {
    throw new AppError(
      "Visit not found",
      404,
      "VISIT_NOT_FOUND"
    );
  }

  res.status(200).json({
    success: true,
    message: "Visit updated successfully",
    data: visit,
  });
});

module.exports = {
  createVisit,
  getVisits,
  getVisitById,
  updateVisit,
};