const router = require("express").Router();

const labOrderController = require("./labOrder.controller");

const protect = require("../../middlewares/auth");

const authorize = require("../../middlewares/authorize");

const validate = require("../../middlewares/validation");

const {
  createLabOrderSchema,
  updateLabOrderSchema,
  labOrderListQuerySchema,
} = require("./labOrder.validation");
const { validateQuery, validateId } = validate;

// ---------------------------------------------
// Create
// ---------------------------------------------

router.post(
  "/",
  protect,
  authorize("admin", "doctor"),
  validate(createLabOrderSchema),
  labOrderController.createLabOrder
);

// ---------------------------------------------
// Get All
// ---------------------------------------------

router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(labOrderListQuerySchema),
  labOrderController.getLabOrders
);

// ---------------------------------------------
// Get By ID
// ---------------------------------------------

router.get(
  "/:id",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateId("id"),
  labOrderController.getLabOrderById
);

// ---------------------------------------------
// Update
// ---------------------------------------------

router.patch(
  "/:id",
  protect,
  authorize("admin", "doctor"),
  validateId("id"),
  validate(updateLabOrderSchema),
  labOrderController.updateLabOrder
);

module.exports = router;