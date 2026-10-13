const router = require("express").Router()
const appointmentController = require("./appointment.controller");

const {
    createAppointmentSchema,
    updateAppointmentSchema,
    appointmentListQuerySchema
} = require("./appointment.validation");

const { validate, validateQuery, validateId } = require("../../middlewares/validation");
const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");

router.post(
    "/",
    protect,
    authorize("admin", "receptionist"),
    validate(createAppointmentSchema),
    appointmentController.createAppointment
);

router.get(
    "/",
    protect,
    authorize("admin", "doctor", "receptionist"),
    validateQuery(appointmentListQuerySchema),
    appointmentController.getAppointments
);

router.get(
    "/:id",
    protect,
    authorize("admin", "doctor", "receptionist"),
    validateId("id", "appointment ID"),
    appointmentController.getAppointmentById
);

router.patch(
    "/:id",
    protect,
    authorize("admin", "doctor", "receptionist"),
    validateId("id", "appointment ID"),
    validate(updateAppointmentSchema),
    appointmentController.updateAppointment
);

router.delete(
    "/:id",
    protect,
    authorize("admin", "receptionist"),
    validateId("id", "appointment ID"),
    appointmentController.cancelAppointment
);

module.exports = router;