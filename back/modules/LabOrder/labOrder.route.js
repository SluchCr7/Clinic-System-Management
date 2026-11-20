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

// Create - Doctor Only
router.post(
  "/",
  protect,
  authorize("doctor"),
  validate(createLabOrderSchema),
  labOrderController.createLabOrder
);

// Get All - Doctor (own clinic) & Admin (oversight)
router.get(
  "/",
  protect,
  authorize("admin", "doctor"),
  validateQuery(labOrderListQuerySchema),
  labOrderController.getLabOrders
);

// Get By ID - Doctor (own clinic) & Admin (oversight)
router.get(
  "/:id",
  protect,
  authorize("admin", "doctor"),
  validateId("id"),
  labOrderController.getLabOrderById
);

// Update - Doctor & Admin
router.patch(
  "/:id",
  protect,
  authorize("admin", "doctor"),
  validateId("id"),
  validate(updateLabOrderSchema),
  labOrderController.updateLabOrder
);

module.exports = router;
