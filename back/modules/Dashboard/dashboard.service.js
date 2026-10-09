const Patient = require("../Patient/patient.model");
const Doctor = require("../Doctor/doctor.model");
const Appointment = require("../Appointment/appointment.model");
const Visit = require("../Visit/visit.model");
const Invoice = require("../Invoice/invoice.model");
const Payment = require("../Payment/payment.model");
const LabOrder = require("../LabOrder/labOrder.model");
const PerformedService = require("../performedService/performedService.model");
const {
  getReportDateRange,
} = require("./dashboard.utils");
const getTodayRange = () => {
  const now = new Date();

  const cairoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return {
    startOfDay: new Date(`${cairoDate}T00:00:00+03:00`),
    endOfDay: new Date(`${cairoDate}T23:59:59.999+03:00`),
  };
};

const getStatusCount = (stats, status) => {
  return stats.find((item) => item._id === status)?.count || 0;
};

const getDashboardOverview = async () => {
  const { startOfDay, endOfDay } = getTodayRange();

  const [
    patientStats,
    doctorStats,
    appointmentStats,
    todayAppointmentStats,
    visitStats,
    invoiceFinancialStats,
    invoiceStatusStats,
    paymentFinancialStats,
    todayRevenueStats,
    labOrderStats,
  ] = await Promise.all([
    // --------------------------------------------------
    // PATIENTS
    // --------------------------------------------------
    Patient.aggregate([
      {
        $group: {
          _id: null,

          totalPatients: {
            $sum: 1,
          },

          activePatients: {
            $sum: {
              $cond: [{ $eq: ["$isActive", true] }, 1, 0],
            },
          },

          inactivePatients: {
            $sum: {
              $cond: [{ $eq: ["$isActive", false] }, 1, 0],
            },
          },
        },
      },
    ]),

    // --------------------------------------------------
    // DOCTORS
    // --------------------------------------------------
    Doctor.aggregate([
      {
        $group: {
          _id: null,

          totalDoctors: {
            $sum: 1,
          },

          activeDoctors: {
            $sum: {
              $cond: [{ $eq: ["$isActive", true] }, 1, 0],
            },
          },

          inactiveDoctors: {
            $sum: {
              $cond: [{ $eq: ["$isActive", false] }, 1, 0],
            },
          },
        },
      },
    ]),

    // --------------------------------------------------
    // ALL APPOINTMENTS
    // --------------------------------------------------
    Appointment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    // --------------------------------------------------
    // TODAY'S APPOINTMENTS
    // --------------------------------------------------
    Appointment.aggregate([
      {
        $match: {
          appointmentDate: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    // --------------------------------------------------
    // VISITS
    // --------------------------------------------------
    Visit.countDocuments(),

    // --------------------------------------------------
    // INVOICE FINANCIAL STATS
    // --------------------------------------------------
    Invoice.aggregate([
      {
        $match: {
          status: {
            $ne: "cancelled",
          },
        },
      },
      {
        $group: {
          _id: null,

          totalInvoiced: {
            $sum: "$total",
          },

          totalOutstanding: {
            $sum: "$remainingAmount",
          },
        },
      },
    ]),

    // --------------------------------------------------
    // INVOICE STATUS STATS
    // --------------------------------------------------
    Invoice.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    // --------------------------------------------------
    // ALL PAYMENTS
    // --------------------------------------------------
    Payment.aggregate([
      {
        $group: {
          _id: null,

          totalCollected: {
            $sum: "$amount",
          },
        },
      },
    ]),

    // --------------------------------------------------
    // TODAY'S REVENUE
    // --------------------------------------------------
    Payment.aggregate([
      {
        $match: {
          paidAt: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },
      {
        $group: {
          _id: null,

          total: {
            $sum: "$amount",
          },
        },
      },
    ]),

    // --------------------------------------------------
    // LAB ORDERS
    // --------------------------------------------------
    LabOrder.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const patient = patientStats[0] || {
    totalPatients: 0,
    activePatients: 0,
    inactivePatients: 0,
  };

  const doctor = doctorStats[0] || {
    totalDoctors: 0,
    activeDoctors: 0,
    inactiveDoctors: 0,
  };

  const invoiceFinancial = invoiceFinancialStats[0] || {
    totalInvoiced: 0,
    totalOutstanding: 0,
  };

  const paymentFinancial = paymentFinancialStats[0] || {
    totalCollected: 0,
  };

  const todayRevenue = todayRevenueStats[0]?.total || 0;

  const totalAppointments = appointmentStats.reduce(
    (total, item) => total + item.count,
    0
  );

  const todayAppointments = todayAppointmentStats.reduce(
    (total, item) => total + item.count,
    0
  );

  return {
    overview: {
      totalPatients: patient.totalPatients,
      activePatients: patient.activePatients,
      inactivePatients: patient.inactivePatients,

      totalDoctors: doctor.totalDoctors,
      activeDoctors: doctor.activeDoctors,
      inactiveDoctors: doctor.inactiveDoctors,

      totalAppointments,
      todayAppointments,

      completedVisits: visitStats,
    },

    appointments: {
      scheduled: getStatusCount(
        appointmentStats,
        "scheduled"
      ),

      confirmed: getStatusCount(
        appointmentStats,
        "confirmed"
      ),

      completed: getStatusCount(
        appointmentStats,
        "completed"
      ),

      cancelled: getStatusCount(
        appointmentStats,
        "cancelled"
      ),

      noShow: getStatusCount(
        appointmentStats,
        "no-show"
      ),

      today: {
        scheduled: getStatusCount(
          todayAppointmentStats,
          "scheduled"
        ),

        confirmed: getStatusCount(
          todayAppointmentStats,
          "confirmed"
        ),

        completed: getStatusCount(
          todayAppointmentStats,
          "completed"
        ),

        cancelled: getStatusCount(
          todayAppointmentStats,
          "cancelled"
        ),

        noShow: getStatusCount(
          todayAppointmentStats,
          "no-show"
        ),
      },
    },

    financial: {
      totalInvoiced: invoiceFinancial.totalInvoiced,

      totalCollected: paymentFinancial.totalCollected,

      totalOutstanding:
        invoiceFinancial.totalOutstanding,

      todayRevenue,

      invoices: {
        unpaid: getStatusCount(
          invoiceStatusStats,
          "unpaid"
        ),

        partiallyPaid: getStatusCount(
          invoiceStatusStats,
          "partially_paid"
        ),

        paid: getStatusCount(
          invoiceStatusStats,
          "paid"
        ),

        cancelled: getStatusCount(
          invoiceStatusStats,
          "cancelled"
        ),
      },
    },

    labOrders: {
      pending:
        getStatusCount(
          labOrderStats,
          "ordered"
        ) +
        getStatusCount(
          labOrderStats,
          "sample_collected"
        ),

      processing: getStatusCount(
        labOrderStats,
        "processing"
      ),

      completed: getStatusCount(
        labOrderStats,
        "completed"
      ),

      cancelled: getStatusCount(
        labOrderStats,
        "cancelled"
      ),
    },
  };
};


const getRevenueReport = async ({
  period = "month",
  startDate,
  endDate,
} = {}) => {
  const { start, end } = getReportDateRange({
    period,
    startDate,
    endDate,
  });

  const [financialStats, dailyRevenue] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          paidAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$amount",
          },
        },
      },
    ]),

    Payment.aggregate([
      {
        $match: {
          paidAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$paidAt",
              timezone: "Africa/Cairo",
            },
          },
          revenue: {
            $sum: "$amount",
          },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]),
  ]);

  const invoiceStats = await Invoice.aggregate([
    {
      $match: {
        issuedAt: {
          $gte: start,
          $lte: end,
        },
        status: {
          $ne: "cancelled",
        },
      },
    },
    {
      $group: {
        _id: null,
        totalInvoiced: {
          $sum: "$total",
        },
        totalOutstanding: {
          $sum: "$remainingAmount",
        },
      },
    },
  ]);

  return {
    period,
    range: {
      start,
      end,
    },
    totalRevenue: financialStats[0]?.totalRevenue || 0,
    totalInvoiced: invoiceStats[0]?.totalInvoiced || 0,
    totalOutstanding: invoiceStats[0]?.totalOutstanding || 0,
    dailyRevenue: dailyRevenue.map((item) => ({
      date: item._id,
      revenue: item.revenue,
    })),
  };
};

const getAppointmentsReport = async ({
  period = "month",
  startDate,
  endDate,
} = {}) => {
  const { start, end } = getReportDateRange({
    period,
    startDate,
    endDate,
  });

  const [statusStats, dailyStats] = await Promise.all([
    Appointment.aggregate([
      {
        $match: {
          appointmentDate: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    Appointment.aggregate([
      {
        $match: {
          appointmentDate: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$appointmentDate",
                timezone: "Africa/Cairo",
              },
            },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          total: { $sum: "$count" },
          scheduled: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "scheduled"] }, "$count", 0],
            },
          },
          confirmed: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "confirmed"] }, "$count", 0],
            },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "completed"] }, "$count", 0],
            },
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "cancelled"] }, "$count", 0],
            },
          },
          noShow: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "no-show"] }, "$count", 0],
            },
          },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]),
  ]);

  const totalAppointments = statusStats.reduce((total, item) => total + item.count, 0);

  return {
    period,
    range: {
      start,
      end,
    },
    totalAppointments,
    byStatus: {
      scheduled: getStatusCount(statusStats, "scheduled"),
      confirmed: getStatusCount(statusStats, "confirmed"),
      completed: getStatusCount(statusStats, "completed"),
      cancelled: getStatusCount(statusStats, "cancelled"),
      noShow: getStatusCount(statusStats, "no-show"),
    },
    dailyAppointments: dailyStats.map((item) => ({
      date: item._id,
      total: item.total,
      scheduled: item.scheduled,
      confirmed: item.confirmed,
      completed: item.completed,
      cancelled: item.cancelled,
      noShow: item.noShow,
    })),
  };
};

const getPatientsReport = async ({
  period = "month",
  startDate,
  endDate,
} = {}) => {
  const { start, end } = getReportDateRange({
    period,
    startDate,
    endDate,
  });

  const [currentStats, periodStats, genderStats, dailyStats] = await Promise.all([
    Patient.aggregate([
      {
        $group: {
          _id: null,
          totalPatients: { $sum: 1 },
          activePatients: {
            $sum: {
              $cond: [{ $eq: ["$isActive", true] }, 1, 0],
            },
          },
          inactivePatients: {
            $sum: {
              $cond: [{ $eq: ["$isActive", false] }, 1, 0],
            },
          },
        },
      },
    ]),
    Patient.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: null,
          newPatients: { $sum: 1 },
        },
      },
    ]),
    Patient.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 },
        },
      },
    ]),
    Patient.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Africa/Cairo",
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]),
  ]);

  const currentPatients = currentStats[0] || {
    totalPatients: 0,
    activePatients: 0,
    inactivePatients: 0,
  };

  const periodPatients = periodStats[0] || {
    newPatients: 0,
  };

  return {
    period,
    range: {
      start,
      end,
    },
    current: {
      totalPatients: currentPatients.totalPatients,
      activePatients: currentPatients.activePatients,
      inactivePatients: currentPatients.inactivePatients,
    },
    periodStats: {
      newPatients: periodPatients.newPatients,
      gender: {
        male: getStatusCount(genderStats, "male"),
        female: getStatusCount(genderStats, "female"),
      },
    },
    dailyNewPatients: dailyStats.map((item) => ({
      date: item._id,
      count: item.count,
    })),
  };
};

const getDoctorsReport = async ({
  period = "month",
  startDate,
  endDate,
} = {}) => {
  const { start, end } = getReportDateRange({
    period,
    startDate,
    endDate,
  });

  const [currentStats, periodStats, specializationStats, experienceStats, feeStats, dailyStats] = await Promise.all([
    Doctor.aggregate([
      {
        $group: {
          _id: null,
          totalDoctors: { $sum: 1 },
          activeDoctors: {
            $sum: {
              $cond: [{ $eq: ["$isActive", true] }, 1, 0],
            },
          },
          inactiveDoctors: {
            $sum: {
              $cond: [{ $eq: ["$isActive", false] }, 1, 0],
            },
          },
          averageExperience: { $avg: "$yearsOfExperience" },
          averageConsultationFee: { $avg: "$consultationFee" },
        },
      },
    ]),
    Doctor.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: null,
          newDoctors: { $sum: 1 },
        },
      },
    ]),
    Doctor.aggregate([
      {
        $group: {
          _id: "$specialization",
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ]),
    Doctor.aggregate([
      {
        $bucket: {
          groupBy: "$yearsOfExperience",
          boundaries: [0, 3, 6, 11, 21, 71],
          default: "unknown",
          output: {
            count: { $sum: 1 },
          },
        },
      },
    ]),
    Doctor.aggregate([
      {
        $group: {
          _id: null,
          minimumFee: { $min: "$consultationFee" },
          maximumFee: { $max: "$consultationFee" },
        },
      },
    ]),
    Doctor.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Africa/Cairo",
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]),
  ]);

  const current = currentStats[0] || {
    totalDoctors: 0,
    activeDoctors: 0,
    inactiveDoctors: 0,
    averageExperience: 0,
    averageConsultationFee: 0,
  };

  const periodData = periodStats[0] || { newDoctors: 0 };
  const feeData = feeStats[0] || { minimumFee: 0, maximumFee: 0 };

  return {
    period,
    range: {
      start,
      end,
    },
    current: {
      totalDoctors: current.totalDoctors,
      activeDoctors: current.activeDoctors,
      inactiveDoctors: current.inactiveDoctors,
      averageExperience: Number((current.averageExperience || 0).toFixed(2)),
      averageConsultationFee: Number((current.averageConsultationFee || 0).toFixed(2)),
      minimumConsultationFee: feeData.minimumFee || 0,
      maximumConsultationFee: feeData.maximumFee || 0,
    },
    periodStats: {
      newDoctors: periodData.newDoctors,
      specializations: specializationStats.map((item) => ({
        specialization: item._id,
        count: item.count,
      })),
      experience: experienceStats.map((item) => ({
        range:
          item._id === 0
            ? "0-2"
            : item._id === 3
            ? "3-5"
            : item._id === 6
            ? "6-10"
            : item._id === 11
            ? "11-20"
            : item._id === 21
            ? "21+"
            : "Unknown",
        count: item.count,
      })),
    },
    dailyNewDoctors: dailyStats.map((item) => ({
      date: item._id,
      count: item.count,
    })),
  };
};

const getLabOrdersReport = async ({
  period = "month",
  startDate,
  endDate,
} = {}) => {
  const { start, end } = getReportDateRange({
    period,
    startDate,
    endDate,
  });

  const [statusStats, priorityStats, dailyStats] = await Promise.all([
    LabOrder.aggregate([
      {
        $match: {
          orderedAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    LabOrder.aggregate([
      {
        $match: {
          orderedAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]),
    LabOrder.aggregate([
      {
        $match: {
          orderedAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$orderedAt",
                timezone: "Africa/Cairo",
              },
            },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          total: { $sum: "$count" },
          ordered: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "ordered"] }, "$count", 0],
            },
          },
          sampleCollected: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "sample_collected"] }, "$count", 0],
            },
          },
          processing: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "processing"] }, "$count", 0],
            },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "completed"] }, "$count", 0],
            },
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "cancelled"] }, "$count", 0],
            },
          },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]),
  ]);

  const totalOrders = statusStats.reduce((total, item) => total + item.count, 0);

  return {
    period,
    range: {
      start,
      end,
    },
    totalOrders,
    byStatus: {
      ordered: getStatusCount(statusStats, "ordered"),
      sampleCollected: getStatusCount(statusStats, "sample_collected"),
      processing: getStatusCount(statusStats, "processing"),
      completed: getStatusCount(statusStats, "completed"),
      cancelled: getStatusCount(statusStats, "cancelled"),
    },
    byPriority: {
      routine: getStatusCount(priorityStats, "routine"),
      urgent: getStatusCount(priorityStats, "urgent"),
      stat: getStatusCount(priorityStats, "stat"),
    },
    dailyOrders: dailyStats.map((item) => ({
      date: item._id,
      total: item.total,
      ordered: item.ordered,
      sampleCollected: item.sampleCollected,
      processing: item.processing,
      completed: item.completed,
      cancelled: item.cancelled,
    })),
  };
};

const getPaymentsReport = async ({
  period = "month",
  startDate,
  endDate,
} = {}) => {
  const { start, end } = getReportDateRange({
    period,
    startDate,
    endDate,
  });

  const [paymentStats, methodStats, dailyStats, invoiceStats] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          paidAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$amount" },
          paymentCount: { $sum: 1 },
          averagePayment: { $avg: "$amount" },
          minimumPayment: { $min: "$amount" },
          maximumPayment: { $max: "$amount" },
        },
      },
    ]),
    Payment.aggregate([
      {
        $match: {
          paidAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: "$method",
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { amount: -1 },
      },
    ]),
    Payment.aggregate([
      {
        $match: {
          paidAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$paidAt",
              timezone: "Africa/Cairo",
            },
          },
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          _id: 1,
        },
      },
    ]),
    Invoice.aggregate([
      {
        $match: {
          issuedAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalInvoiced: {
            $sum: {
              $cond: [{ $ne: ["$status", "cancelled"] }, "$total", 0],
            },
          },
          totalOutstanding: {
            $sum: {
              $cond: [{ $ne: ["$status", "cancelled"] }, "$remainingAmount", 0],
            },
          },
          invoiceCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const payments = paymentStats[0] || {
    totalCollected: 0,
    paymentCount: 0,
    averagePayment: 0,
    minimumPayment: 0,
    maximumPayment: 0,
  };

  const invoices = invoiceStats[0] || {
    totalInvoiced: 0,
    totalOutstanding: 0,
    invoiceCount: 0,
  };

  return {
    period,
    range: {
      start,
      end,
    },
    payments: {
      totalCollected: payments.totalCollected,
      paymentCount: payments.paymentCount,
      averagePayment: Number((payments.averagePayment || 0).toFixed(2)),
      minimumPayment: payments.minimumPayment,
      maximumPayment: payments.maximumPayment,
    },
    invoices: {
      invoiceCount: invoices.invoiceCount,
      totalInvoiced: invoices.totalInvoiced,
      totalOutstanding: invoices.totalOutstanding,
    },
    byMethod: methodStats.map((item) => ({
      method: item._id,
      amount: item.amount,
      count: item.count,
    })),
    dailyPayments: dailyStats.map((item) => ({
      date: item._id,
      amount: item.amount,
      count: item.count,
    })),
  };
};

const getMedicalServicesReport = async ({
  period = "month",
  startDate,
  endDate,
} = {}) => {
  const { start, end } = getReportDateRange({
    period,
    startDate,
    endDate,
  });

  const [summaryStats, serviceStats, categoryStats, dailyStats] = await Promise.all([
    PerformedService.aggregate([
      {
        $match: {
          performedAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalServices: { $sum: "$quantity" },
          totalOperations: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $subtract: [{ $multiply: ["$price", "$quantity"] }, "$discount"],
            },
          },
          averageServicePrice: { $avg: "$price" },
        },
      },
    ]),
    PerformedService.aggregate([
      {
        $match: {
          performedAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            service: "$service",
            name: "$serviceName",
            code: "$serviceCode",
          },
          quantity: { $sum: "$quantity" },
          operations: { $sum: 1 },
          revenue: {
            $sum: {
              $subtract: [{ $multiply: ["$price", "$quantity"] }, "$discount"],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    PerformedService.aggregate([
      {
        $match: {
          performedAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $lookup: {
          from: "medicalservices",
          localField: "service",
          foreignField: "_id",
          as: "serviceData",
        },
      },
      {
        $unwind: {
          path: "$serviceData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$serviceData.category",
          quantity: { $sum: "$quantity" },
          revenue: {
            $sum: {
              $subtract: [{ $multiply: ["$price", "$quantity"] }, "$discount"],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    PerformedService.aggregate([
      {
        $match: {
          performedAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$performedAt",
              timezone: "Africa/Cairo",
            },
          },
          quantity: { $sum: "$quantity" },
          operations: { $sum: 1 },
          revenue: {
            $sum: {
              $subtract: [{ $multiply: ["$price", "$quantity"] }, "$discount"],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const summary = summaryStats[0] || {
    totalServices: 0,
    totalOperations: 0,
    totalRevenue: 0,
    averageServicePrice: 0,
  };

  return {
    period,
    range: {
      start,
      end,
    },
    summary: {
      totalServices: summary.totalServices,
      totalOperations: summary.totalOperations,
      totalRevenue: summary.totalRevenue,
      averageServicePrice: Number((summary.averageServicePrice || 0).toFixed(2)),
    },
    services: serviceStats.map((item) => ({
      serviceId: item._id.service,
      serviceName: item._id.name,
      serviceCode: item._id.code,
      quantity: item.quantity,
      operations: item.operations,
      revenue: item.revenue,
    })),
    categories: categoryStats.map((item) => ({
      category: item._id || "Unknown",
      quantity: item.quantity,
      revenue: item.revenue,
    })),
    dailyServices: dailyStats.map((item) => ({
      date: item._id,
      quantity: item.quantity,
      operations: item.operations,
      revenue: item.revenue,
    })),
  };
};

module.exports = {
  getDashboardOverview,
  getRevenueReport,
  getAppointmentsReport,
  getPatientsReport,
  getDoctorsReport,
  getLabOrdersReport,
  getPaymentsReport,
  getMedicalServicesReport,
};
