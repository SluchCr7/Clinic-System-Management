const express = require("express");
const router = express.Router();

const assignmentController = require("./doctorAssignment.controller");
const {
  createAssignmentSchema,
  updateAssignmentSchema,
  assignmentListQuerySchema,
} = require("./doctorAssignment.validation");

const { validate, validateQuery, validateId } = require("../../middlewares/validation");
const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");

// Receptionists/Doctors/Admins can see my-doctors list
router.get(
  "/my-doctors",
  protect,
  assignmentController.getMyDoctors
);

// Admin can create assignments
router.post(
  "/",
  protect,
  authorize("admin"),
  validate(createAssignmentSchema),
  assignmentController.createAssignment
);

// Admin can list all; Receptionist/Doctor can view their own
router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(assignmentListQuerySchema),
  assignmentController.getAssignments
);

// Get assignment by ID
router.get(
  "/:id",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id", "assignment ID"),
  assignmentController.getAssignmentById
);

// Admin can update assignment
router.patch(
  "/:id",
  protect,
  authorize("admin"),
  validateId("id", "assignment ID"),
  validate(updateAssignmentSchema),
  assignmentController.updateAssignment
);

// Admin can delete/deactivate assignment
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  validateId("id", "assignment ID"),
  assignmentController.deleteAssignment
);

module.exports = router;
