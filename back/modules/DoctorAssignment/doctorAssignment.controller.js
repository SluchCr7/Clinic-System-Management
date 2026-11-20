const asyncHandler = require("express-async-handler");
const assignmentService = require("./doctorAssignment.service");
const { AppError } = require("../../middlewares/errorHandler");

const createAssignment = asyncHandler(async (req, res) => {
  const assignment = await assignmentService.createAssignment(req.body, req.user);
  res.status(201).json({
    success: true,
    data: assignment,
  });
});

const getAssignments = asyncHandler(async (req, res) => {
  const result = await assignmentService.getAssignments(req.query, req.user);
  res.status(200).json({
    success: true,
    ...result,
  });
});

const getMyDoctors = asyncHandler(async (req, res) => {
  const doctors = await assignmentService.getMyDoctors(req.user);
  res.status(200).json({
    success: true,
    data: doctors,
  });
});

const getAssignmentById = asyncHandler(async (req, res) => {
  const assignment = await assignmentService.getAssignmentById(req.params.id, req.user);
  if (!assignment) {
    throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
  }
  res.status(200).json({
    success: true,
    data: assignment,
  });
});

const updateAssignment = asyncHandler(async (req, res) => {
  const assignment = await assignmentService.updateAssignment(
    req.params.id,
    req.body,
    req.user
  );
  if (!assignment) {
    throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
  }
  res.status(200).json({
    success: true,
    data: assignment,
  });
});

const deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = await assignmentService.deleteAssignment(
    req.params.id,
    req.user
  );
  if (!assignment) {
    throw new AppError("Assignment not found", 404, "ASSIGNMENT_NOT_FOUND");
  }
  res.status(200).json({
    success: true,
    message: "Assignment deactivated successfully",
  });
});

module.exports = {
  createAssignment,
  getAssignments,
  getMyDoctors,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
};
