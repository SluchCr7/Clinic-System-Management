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

// Create Visit - Clinical Operation: Doctor Only
router.post(
  "/",
  protect,
  authorize("doctor"),
  validate(createVisitSchema),
  visitController.createVisit
);

// Get all Visits - Doctor (own clinic) & Admin (clinical oversight)
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

// Update Visit - Clinical Operation: Doctor Only
router.patch(
  "/:id",
  protect,
  authorize("doctor"),
  validateId("id", "visit ID"),
  validate(updateVisitSchema),
  visitController.updateVisit
);

module.exports = router;
