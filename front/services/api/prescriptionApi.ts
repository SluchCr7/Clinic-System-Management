import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  Prescription,
  CreatePrescriptionRequest,
  UpdatePrescriptionRequest,
  PrescriptionQueryParams,
} from "@/types/prescription";

export const prescriptionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPrescriptions: builder.query<
      PaginatedResponse<Prescription>,
      PrescriptionQueryParams | void
    >({
      query: (params) => ({
        url: "/prescriptions",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "Prescription", id: "LIST" },
              ...result.data.map(({ _id }) => ({
                type: "Prescription" as const,
                id: _id,
              })),
            ]
          : [{ type: "Prescription", id: "LIST" }],
    }),

    getPrescriptionById: builder.query<ApiResponse<Prescription>, string>({
      query: (id) => ({
        url: `/prescriptions/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Prescription", id }],
    }),

    createPrescription: builder.mutation<
      ApiResponse<Prescription>,
      CreatePrescriptionRequest
    >({
      query: (body) => ({
        url: "/prescriptions",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Prescription", id: "LIST" }],
    }),

    updatePrescription: builder.mutation<
      ApiResponse<Prescription>,
      { id: string; data: UpdatePrescriptionRequest }
    >({
      query: ({ id, data }) => ({
        url: `/prescriptions/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Prescription", id },
        { type: "Prescription", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetPrescriptionsQuery,
  useGetPrescriptionByIdQuery,
  useCreatePrescriptionMutation,
  useUpdatePrescriptionMutation,
} = prescriptionApi;
