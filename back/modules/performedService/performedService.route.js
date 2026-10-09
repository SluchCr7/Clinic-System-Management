const express = require("express");

const router = express.Router();

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const { validate, validateQuery, validateId } = require("../../middlewares/validation");

const performedServiceController = require("./performedService.controller");

const {
  createPerformedServiceSchema,
  updatePerformedServiceSchema,
  performedServiceListQuerySchema,
} = require("./performedService.validation");

// Create performed service
router.post(
  "/",
  protect,
  authorize("admin", "doctor"),
  validate(createPerformedServiceSchema),
  performedServiceController.createPerformedService
);

// Get all performed services
router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(performedServiceListQuerySchema),
  performedServiceController.getPerformedServices
);

// Get performed service by ID
router.get(
  "/:id",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id", "performed service ID"),
  performedServiceController.getPerformedServiceById
);

// Update performed service
router.patch(
  "/:id",
  protect,
  authorize("admin", "doctor"),
  validateId("id", "performed service ID"),
  validate(updatePerformedServiceSchema),
  performedServiceController.updatePerformedService
);

module.exports = router;