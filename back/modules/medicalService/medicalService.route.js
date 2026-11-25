const express = require("express");

const router = express.Router();

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const {
  validate,
  validateQuery,
  validateId,
} = require("../../middlewares/validation");

const medicalServiceController = require("./medicalService.controller");

const {
  createMedicalServiceSchema,
  updateMedicalServiceSchema,
  medicalServiceListQuerySchema,
} = require("./medicalService.validation");

// Create Medical Service (doctor or admin)
router.post(
  "/",
  protect,
  authorize("doctor"),
  validate(createMedicalServiceSchema),
  medicalServiceController.createMedicalService
);

// Get Distinct Categories (must be registered before /:id)
router.get(
  "/categories",
  protect,
  authorize("admin", "doctor", "receptionist"),
  medicalServiceController.getCategories
);

// Get All Medical Services
router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(medicalServiceListQuerySchema),
  medicalServiceController.getMedicalServices
);

// Get Medical Service By ID
router.get(
  "/:id",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id", "medical service ID"),
  medicalServiceController.getMedicalServiceById
);

// Activate Medical Service
router.patch(
  "/:id/activate",
  protect,
  authorize("doctor"),
  validateId("id", "medical service ID"),
  medicalServiceController.activateMedicalService
);

// Update Medical Service
router.patch(
  "/:id",
  protect,
  authorize("doctor"),
  validateId("id", "medical service ID"),
  validate(updateMedicalServiceSchema),
  medicalServiceController.updateMedicalService
);

// Deactivate Medical Service
router.delete(
  "/:id",
  protect,
  authorize("admin", "doctor"),
  validateId("id", "medical service ID"),
  medicalServiceController.deactivateMedicalService
);

module.exports = router;
