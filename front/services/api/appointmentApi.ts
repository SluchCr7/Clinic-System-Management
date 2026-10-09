import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse, ApiMessageResponse } from "@/types/api";
import type {
  Appointment,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  AppointmentQueryParams,
} from "@/types/appointment";

export const appointmentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAppointments: builder.query<
      PaginatedResponse<Appointment>,
      AppointmentQueryParams | void
    >({
      query: (params) => ({
        url: "/appointments",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "Appointment", id: "LIST" },
              ...result.data.map(({ _id }) => ({
                type: "Appointment" as const,
                id: _id,
              })),
            ]
          : [{ type: "Appointment", id: "LIST" }],
    }),

    getAppointmentById: builder.query<ApiResponse<Appointment>, string>({
      query: (id) => ({
        url: `/appointments/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Appointment", id }],
    }),

    createAppointment: builder.mutation<
      ApiResponse<Appointment>,
      CreateAppointmentRequest
    >({
      query: (body) => ({
        url: "/appointments",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Appointment", id: "LIST" },
        { type: "Dashboard", id: "OVERVIEW" },
        "Search",
      ],
    }),

    updateAppointment: builder.mutation<
      ApiResponse<Appointment>,
      { id: string; data: UpdateAppointmentRequest }
    >({
      query: ({ id, data }) => ({
        url: `/appointments/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Appointment", id },
        { type: "Appointment", id: "LIST" },
        { type: "Dashboard", id: "OVERVIEW" },
        "Search",
      ],
    }),

    cancelAppointment: builder.mutation<ApiMessageResponse, string>({
      query: (id) => ({
        url: `/appointments/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Appointment", id },
        { type: "Appointment", id: "LIST" },
        { type: "Dashboard", id: "OVERVIEW" },
        "Search",
      ],
    }),
  }),
});

export const {
  useGetAppointmentsQuery,
  useGetAppointmentByIdQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
  useCancelAppointmentMutation,
} = appointmentApi;
