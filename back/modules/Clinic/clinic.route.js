const router = require("express").Router();
const protect = require("../../middlewares/auth");
const { validate } = require("../../middlewares/validation");
const clinicController = require("./clinic.controller");
const { updateClinicSchema } = require("./clinic.validation");

router.get("/me", protect, clinicController.getMyClinic);
router.patch("/me", protect, validate(updateClinicSchema), clinicController.updateMyClinic);

module.exports = router;
