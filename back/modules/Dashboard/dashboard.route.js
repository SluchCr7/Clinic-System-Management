const express = require("express");

const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const { validateQuery } = require("../../middlewares/validation");
const { dashboardReportQuerySchema } = require("./dashboard.validation");

const dashboardController = require("./dashboard.controller");

const router = express.Router();

router.get(
  "/overview",
  protect,
  authorize("admin"),
  dashboardController.getOverview
);
router.get(
  "/reports/revenue",
  protect,
  authorize("admin"),
  validateQuery(dashboardReportQuerySchema),
  dashboardController.getRevenueReport
);
router.get(
  "/reports/appointments",
  protect,
  authorize("admin"),
  validateQuery(dashboardReportQuerySchema),
  dashboardController.getAppointmentsReport
);
router.get(
  "/reports/patients",
  protect,
  authorize("admin"),
  validateQuery(dashboardReportQuerySchema),
  dashboardController.getPatientsReport
);
router.get(
  "/reports/doctors",
  protect,
  authorize("admin"),
  validateQuery(dashboardReportQuerySchema),
  dashboardController.getDoctorsReport
);
router.get(
  "/reports/lab-orders",
  protect,
  authorize("admin"),
  validateQuery(dashboardReportQuerySchema),
  dashboardController.getLabOrdersReport
);
router.get(
  "/reports/payments",
  protect,
  authorize("admin"),
  validateQuery(dashboardReportQuerySchema),
  dashboardController.getPaymentsReport
);
router.get(
  "/reports/medical-services",
  protect,
  authorize("admin"),
  validateQuery(dashboardReportQuerySchema),
  dashboardController.getMedicalServicesReport
);

module.exports = router;