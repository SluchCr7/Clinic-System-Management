import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse, ApiMessageResponse } from "@/types/api";
import type {
  Patient,
  CreatePatientRequest,
  UpdatePatientRequest,
  PatientQueryParams,
} from "@/types/patient";

export const patientApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPatients: builder.query<PaginatedResponse<Patient>, PatientQueryParams | void>({
      query: (params) => ({
        url: "/patients",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "Patient", id: "LIST" },
              ...result.data.map(({ _id }) => ({ type: "Patient" as const, id: _id })),
            ]
          : [{ type: "Patient", id: "LIST" }],
    }),

    getPatientById: builder.query<ApiResponse<Patient>, string>({
      query: (id) => ({
        url: `/patients/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Patient", id }],
    }),

    createPatient: builder.mutation<ApiResponse<Patient>, CreatePatientRequest>({
      query: (body) => ({
        url: "/patients",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Patient", id: "LIST" },
        "Search",
      ],
    }),

    updatePatient: builder.mutation<
      ApiResponse<Patient>,
      { id: string; data: UpdatePatientRequest }
    >({
      query: ({ id, data }) => ({
        url: `/patients/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Patient", id },
        { type: "Patient", id: "LIST" },
        "Search",
      ],
    }),

    deletePatient: builder.mutation<ApiMessageResponse, string>({
      query: (id) => ({
        url: `/patients/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Patient", id },
        { type: "Patient", id: "LIST" },
        "Search",
      ],
    }),
  }),
});

export const {
  useGetPatientsQuery,
  useGetPatientByIdQuery,
  useCreatePatientMutation,
  useUpdatePatientMutation,
  useDeletePatientMutation,
} = patientApi;
