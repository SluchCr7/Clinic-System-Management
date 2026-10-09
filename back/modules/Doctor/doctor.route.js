const router = require("express").Router()

const { validate, validateQuery, validateId } = require("../../middlewares/validation");
const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");

const {
    createDoctorSchema,
    updateDoctorSchema,
    doctorListQuerySchema
} = require("./doctor.validation");

const doctorController = require("./doctor.controller")

router.post(
    "/",
    protect,
    authorize("admin"),
    validate(createDoctorSchema),
    doctorController.createDoctor
)

router.get(
    "/",
    protect,
    authorize("admin", "doctor", "receptionist"),
    validateQuery(doctorListQuerySchema),
    doctorController.getDoctors
)

router.get(
    "/:id",
    protect,
    authorize("admin", "doctor", "receptionist"),
    validateId("id", "doctor ID"),
    doctorController.getDoctorById
)

router.patch(
    "/:id",
    protect,
    authorize("admin"),
    validateId("id", "doctor ID"),
    validate(updateDoctorSchema),
    doctorController.updateDoctor
)

router.delete(
    "/:id",
    protect,
    authorize("admin"),
    validateId("id", "doctor ID"),
    doctorController.deactivateDoctor
)

module.exports = router