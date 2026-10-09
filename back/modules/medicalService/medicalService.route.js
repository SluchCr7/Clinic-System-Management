const express = require("express");

const router = express.Router();

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const { validate, validateQuery, validateId } = require("../../middlewares/validation");

const medicalServiceController = require(
  "./medicalService.controller"
);

const {
  createMedicalServiceSchema,
  updateMedicalServiceSchema,
  medicalServiceListQuerySchema,
} = require("./medicalService.validation");

// Create Medical Service
router.post(
  "/",
  protect,
  authorize("admin"),
  validate(createMedicalServiceSchema),
  medicalServiceController.createMedicalService
);

// Get All Medical Services
router.get(
  "/",
  protect,
  authorize(
    "admin",
    "doctor",
    "receptionist"
  ),
  validateQuery(medicalServiceListQuerySchema),
  medicalServiceController.getMedicalServices
);

// Get Medical Service By ID
router.get(
  "/:id",
  protect,
  authorize(
    "admin",
    "doctor",
    "receptionist"
  ),
  validateId("id", "medical service ID"),
  medicalServiceController.getMedicalServiceById
);

// Update Medical Service
router.patch(
  "/:id",
  protect,
  authorize("admin"),
  validateId("id", "medical service ID"),
  validate(updateMedicalServiceSchema),
  medicalServiceController.updateMedicalService
);

// Deactivate Medical Service
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  validateId("id", "medical service ID"),
  medicalServiceController.deactivateMedicalService
);

module.exports = router;