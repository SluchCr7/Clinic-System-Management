const express = require("express");

const router = express.Router();

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const { validate, validateQuery, validateId } = require("../../middlewares/validation");

const prescriptionController = require("./prescription.controller");

const {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  prescriptionListQuerySchema,
} = require("./prescription.validation");

// Create Prescription
router.post(
  "/",
  protect,
  authorize("admin", "doctor"),
  validate(createPrescriptionSchema),
  prescriptionController.createPrescription
);

// Get all Prescriptions
router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(prescriptionListQuerySchema),
  prescriptionController.getPrescriptions
);

// Get Prescription by ID
router.get(
  "/:id",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id", "prescription ID"),
  prescriptionController.getPrescriptionById
);

// Update Prescription
router.patch(
  "/:id",
  protect,
  authorize("admin", "doctor"),
  validateId("id", "prescription ID"),
  validate(updatePrescriptionSchema),
  prescriptionController.updatePrescription
);

module.exports = router;