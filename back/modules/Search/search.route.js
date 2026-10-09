const router = require("express").Router();

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const { validateQuery } = require("../../middlewares/validation");
const { globalSearchQuerySchema } = require("./search.validation");
const searchController = require("./search.controller");

router.get(
  "/",
  protect,
  authorize("admin", "doctor", "receptionist"),
  validateQuery(globalSearchQuerySchema),
  searchController.globalSearch
);

module.exports = router;
