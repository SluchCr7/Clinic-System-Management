import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse } from "@/types/api";
import type {
  DashboardOverview,
  DashboardReportQuery,
  RevenueReport,
  AppointmentsReport,
  PatientsReport,
  DoctorsReport,
  LabOrdersReport,
  PaymentsReport,
  MedicalServicesReport,
} from "@/types/dashboard";

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardOverview: builder.query<ApiResponse<DashboardOverview>, void>({
      query: () => ({
        url: "/dashboard/overview",
        method: "GET",
      }),
      keepUnusedDataFor: 120,
      providesTags: [{ type: "Dashboard", id: "OVERVIEW" }],
    }),

    getRevenueReport: builder.query<
      ApiResponse<RevenueReport>,
      DashboardReportQuery | void
    >({
      query: (params) => ({
        url: "/dashboard/reports/revenue",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      keepUnusedDataFor: 120,
      providesTags: [{ type: "Dashboard", id: "REVENUE_REPORT" }],
    }),

    getAppointmentsReport: builder.query<
      ApiResponse<AppointmentsReport>,
      DashboardReportQuery | void
    >({
      query: (params) => ({
        url: "/dashboard/reports/appointments",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      keepUnusedDataFor: 120,
      providesTags: [{ type: "Dashboard", id: "APPOINTMENTS_REPORT" }],
    }),

    getPatientsReport: builder.query<
      ApiResponse<PatientsReport>,
      DashboardReportQuery | void
    >({
      query: (params) => ({
        url: "/dashboard/reports/patients",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      keepUnusedDataFor: 120,
      providesTags: [{ type: "Dashboard", id: "PATIENTS_REPORT" }],
    }),

    getDoctorsReport: builder.query<
      ApiResponse<DoctorsReport>,
      DashboardReportQuery | void
    >({
      query: (params) => ({
        url: "/dashboard/reports/doctors",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      keepUnusedDataFor: 120,
      providesTags: [{ type: "Dashboard", id: "DOCTORS_REPORT" }],
    }),

    getLabOrdersReport: builder.query<
      ApiResponse<LabOrdersReport>,
      DashboardReportQuery | void
    >({
      query: (params) => ({
        url: "/dashboard/reports/lab-orders",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      keepUnusedDataFor: 120,
      providesTags: [{ type: "Dashboard", id: "LAB_ORDERS_REPORT" }],
    }),

    getPaymentsReport: builder.query<
      ApiResponse<PaymentsReport>,
      DashboardReportQuery | void
    >({
      query: (params) => ({
        url: "/dashboard/reports/payments",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      keepUnusedDataFor: 120,
      providesTags: [{ type: "Dashboard", id: "PAYMENTS_REPORT" }],
    }),

    getMedicalServicesReport: builder.query<
      ApiResponse<MedicalServicesReport>,
      DashboardReportQuery | void
    >({
      query: (params) => ({
        url: "/dashboard/reports/medical-services",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      keepUnusedDataFor: 120,
      providesTags: [{ type: "Dashboard", id: "MEDICAL_SERVICES_REPORT" }],
    }),
  }),
});

export const {
  useGetDashboardOverviewQuery,
  useGetRevenueReportQuery,
  useGetAppointmentsReportQuery,
  useGetPatientsReportQuery,
  useGetDoctorsReportQuery,
  useGetLabOrdersReportQuery,
  useGetPaymentsReportQuery,
  useGetMedicalServicesReportQuery,
} = dashboardApi;
