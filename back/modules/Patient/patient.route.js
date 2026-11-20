const express = require("express");

const router = express.Router();

const patientController = require("./patient.controller");

const {
  createPatientSchema,
  updatePatientSchema,
  patientListQuerySchema,
} = require("./patient.validation");

const { validate, validateQuery, validateId } = require("../../middlewares/validation");
const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");

// ONLY Receptionists can create patient profiles
router.post(
  "/",
  protect,
  authorize("receptionist"),
  validate(createPatientSchema),
  patientController.createPatient
);

// Admin, Doctor, Receptionist can list patients (scoped by clinic)
router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(patientListQuerySchema),
  patientController.getPatients
);

// Admin, Doctor, Receptionist can get patient by ID (scoped by clinic)
router.get(
  "/:id",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id", "patient ID"),
  patientController.getPatientById
);

// Receptionist can update their authorized patients (Admin has administrative oversight)
router.patch(
  "/:id",
  protect,
  authorize("receptionist", "admin"),
  validateId("id", "patient ID"),
  validate(updatePatientSchema),
  patientController.updatePatient
);

// Deactivate patient
router.delete(
  "/:id",
  protect,
  authorize("admin", "receptionist"),
  validateId("id", "patient ID"),
  patientController.deletePatient
);

module.exports = router;
