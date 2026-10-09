const asyncHandler = require("express-async-handler");

const dashboardService = require("./dashboard.service");

const getOverview = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardOverview();

  res.status(200).json({
    success: true,
    data,
  });
});

const getRevenueReport = asyncHandler(async (req, res) => {
  const {
    period,
    startDate,
    endDate,
  } = req.query;

  const data = await dashboardService.getRevenueReport({
    period,
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data,
  });
});

const getAppointmentsReport = asyncHandler(
  async (req, res) => {
    const {
      period,
      startDate,
      endDate,
    } = req.query;

    const data =
      await dashboardService.getAppointmentsReport({
        period,
        startDate,
        endDate,
      });

    res.status(200).json({
      success: true,
      data,
    });
  }
);

const getPatientsReport = asyncHandler(
  async (req, res) => {
    const {
      period,
      startDate,
      endDate,
    } = req.query;

    const data =
      await dashboardService.getPatientsReport({
        period,
        startDate,
        endDate,
      });

    res.status(200).json({
      success: true,
      data,
    });
  }
);

const getDoctorsReport = asyncHandler(
  async (req, res) => {
    const {
      period,
      startDate,
      endDate,
    } = req.query;

    const data =
      await dashboardService.getDoctorsReport({
        period,
        startDate,
        endDate,
      });

    res.status(200).json({
      success: true,
      data,
    });
  }
);

const getLabOrdersReport = asyncHandler(
  async (req, res) => {
    const {
      period,
      startDate,
      endDate,
    } = req.query;

    const data =
      await dashboardService.getLabOrdersReport({
        period,
        startDate,
        endDate,
      });

    res.status(200).json({
      success: true,
      data,
    });
  }
);

const getPaymentsReport = asyncHandler(
  async (req, res) => {
    const {
      period,
      startDate,
      endDate,
    } = req.query;

    const data =
      await dashboardService.getPaymentsReport({
        period,
        startDate,
        endDate,
      });

    res.status(200).json({
      success: true,
      data,
    });
  }
);

const getMedicalServicesReport = asyncHandler(
  async (req, res) => {
    const {
      period,
      startDate,
      endDate,
    } = req.query;

    const data =
      await dashboardService.getMedicalServicesReport({
        period,
        startDate,
        endDate,
      });

    res.status(200).json({
      success: true,
      data,
    });
  }
);

module.exports = {
    getOverview,
    getRevenueReport,
    getAppointmentsReport,
    getPatientsReport,
    getDoctorsReport,
    getLabOrdersReport,
    getPaymentsReport,
    getMedicalServicesReport
};