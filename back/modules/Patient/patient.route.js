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

router.post(
  "/",
  protect,
  authorize("admin", "receptionist"),
  validate(createPatientSchema),
  patientController.createPatient
);

router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(patientListQuerySchema),
  patientController.getPatients
);

router.get(
  "/:id",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id", "patient ID"),
  patientController.getPatientById
);

router.patch(
  "/:id",
  protect,
  authorize("admin", "receptionist"),
  validateId("id", "patient ID"),
  validate(updatePatientSchema),
  patientController.updatePatient
);

router.delete(
  "/:id",
  protect,
  authorize("admin", "receptionist"),
  validateId("id", "patient ID"),
  patientController.deletePatient
);

module.exports = router;