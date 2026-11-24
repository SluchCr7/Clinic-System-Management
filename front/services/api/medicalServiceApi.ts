import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse, ApiMessageResponse } from "@/types/api";
import type {
  MedicalService,
  CreateMedicalServiceRequest,
  UpdateMedicalServiceRequest,
  MedicalServiceQueryParams,
} from "@/types/medicalService";

export const medicalServiceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMedicalServices: builder.query<
      PaginatedResponse<MedicalService>,
      MedicalServiceQueryParams | void
    >({
      query: (params) => ({
        url: "/medical-services",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "MedicalService", id: "LIST" },
              ...result.data.map(({ _id }) => ({
                type: "MedicalService" as const,
                id: _id,
              })),
            ]
          : [{ type: "MedicalService", id: "LIST" }],
    }),

    getCategories: builder.query<ApiResponse<string[]>, { doctor?: string } | void>({
      query: (params) => ({
        url: "/medical-services/categories",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: [{ type: "MedicalService", id: "CATEGORIES" }],
    }),

    getMedicalServiceById: builder.query<ApiResponse<MedicalService>, string>({
      query: (id) => ({
        url: `/medical-services/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "MedicalService", id }],
    }),

    createMedicalService: builder.mutation<
      ApiResponse<MedicalService>,
      CreateMedicalServiceRequest
    >({
      query: (body) => ({
        url: "/medical-services",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "MedicalService", id: "LIST" },
        { type: "MedicalService", id: "CATEGORIES" },
        "Search",
      ],
    }),

    updateMedicalService: builder.mutation<
      ApiResponse<MedicalService>,
      { id: string; data: UpdateMedicalServiceRequest }
    >({
      query: ({ id, data }) => ({
        url: `/medical-services/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "MedicalService", id },
        { type: "MedicalService", id: "LIST" },
        { type: "MedicalService", id: "CATEGORIES" },
        "Search",
      ],
    }),

    activateMedicalService: builder.mutation<ApiMessageResponse, string>({
      query: (id) => ({
        url: `/medical-services/${id}/activate`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "MedicalService", id },
        { type: "MedicalService", id: "LIST" },
        { type: "MedicalService", id: "CATEGORIES" },
        "Search",
      ],
    }),

    deactivateMedicalService: builder.mutation<ApiMessageResponse, string>({
      query: (id) => ({
        url: `/medical-services/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "MedicalService", id },
        { type: "MedicalService", id: "LIST" },
        { type: "MedicalService", id: "CATEGORIES" },
        "Search",
      ],
    }),
  }),
});

export const {
  useGetMedicalServicesQuery,
  useGetCategoriesQuery,
  useGetMedicalServiceByIdQuery,
  useCreateMedicalServiceMutation,
  useUpdateMedicalServiceMutation,
  useActivateMedicalServiceMutation,
  useDeactivateMedicalServiceMutation,
} = medicalServiceApi;
