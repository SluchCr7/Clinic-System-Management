const visitController = require("./visit.controller")
const router = require("express").Router()
const {
    createVisitSchema,
    updateVisitSchema,
    visitListQuerySchema,
} = require("./visit.validation")


const { validate, validateQuery, validateId } = require("../../middlewares/validation");
const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");

// Create Visit
router.post(
  "/",
  protect,
  authorize("admin", "doctor"),
  validate(createVisitSchema),
  visitController.createVisit
);

// Get all Visits
router.get(
  "/",
  protect,
  authorize("admin", "doctor"),
  validateQuery(visitListQuerySchema),
  visitController.getVisits
);

// Get Visit by ID
router.get(
  "/:id",
  protect,
  authorize("admin", "doctor"),
  validateId("id", "visit ID"),
  visitController.getVisitById
);

// Update Visit
router.patch(
  "/:id",
  protect,
  authorize("admin", "doctor"),
  validateId("id", "visit ID"),
  validate(updateVisitSchema),
  visitController.updateVisit
);

module.exports = router;