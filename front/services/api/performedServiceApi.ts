import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  PerformedService,
  CreatePerformedServiceRequest,
  UpdatePerformedServiceRequest,
  PerformedServiceQueryParams,
} from "@/types/performedService";

export const performedServiceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPerformedServices: builder.query<
      PaginatedResponse<PerformedService>,
      PerformedServiceQueryParams | void
    >({
      query: (params) => ({
        url: "/performed-services",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "PerformedService", id: "LIST" },
              ...result.data.map(({ _id }) => ({
                type: "PerformedService" as const,
                id: _id,
              })),
            ]
          : [{ type: "PerformedService", id: "LIST" }],
    }),

    getPerformedServiceById: builder.query<ApiResponse<PerformedService>, string>({
      query: (id) => ({
        url: `/performed-services/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "PerformedService", id }],
    }),

    createPerformedService: builder.mutation<
      ApiResponse<PerformedService>,
      CreatePerformedServiceRequest
    >({
      query: (body) => ({
        url: "/performed-services",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, body) => [
        { type: "PerformedService", id: "LIST" },
        { type: "Invoice", id: "LIST" },
        { type: "Visit", id: body.visit },
        { type: "Dashboard", id: "OVERVIEW" },
      ],
    }),

    updatePerformedService: builder.mutation<
      ApiResponse<PerformedService>,
      { id: string; data: UpdatePerformedServiceRequest }
    >({
      query: ({ id, data }) => ({
        url: `/performed-services/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "PerformedService", id },
        { type: "PerformedService", id: "LIST" },
        { type: "Invoice", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetPerformedServicesQuery,
  useGetPerformedServiceByIdQuery,
  useCreatePerformedServiceMutation,
  useUpdatePerformedServiceMutation,
} = performedServiceApi;
