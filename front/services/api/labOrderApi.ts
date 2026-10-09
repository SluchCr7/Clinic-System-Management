import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  LabOrder,
  CreateLabOrderRequest,
  UpdateLabOrderRequest,
  LabOrderQueryParams,
} from "@/types/labOrder";

export const labOrderApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLabOrders: builder.query<
      PaginatedResponse<LabOrder>,
      LabOrderQueryParams | void
    >({
      query: (params) => ({
        url: "/lab-orders",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "LabOrder", id: "LIST" },
              ...result.data.map(({ _id }) => ({
                type: "LabOrder" as const,
                id: _id,
              })),
            ]
          : [{ type: "LabOrder", id: "LIST" }],
    }),

    getLabOrderById: builder.query<ApiResponse<LabOrder>, string>({
      query: (id) => ({
        url: `/lab-orders/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "LabOrder", id }],
    }),

    createLabOrder: builder.mutation<
      ApiResponse<LabOrder>,
      CreateLabOrderRequest
    >({
      query: (body) => ({
        url: "/lab-orders",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "LabOrder", id: "LIST" },
        { type: "Dashboard", id: "OVERVIEW" },
      ],
    }),

    updateLabOrder: builder.mutation<
      ApiResponse<LabOrder>,
      { id: string; data: UpdateLabOrderRequest }
    >({
      query: ({ id, data }) => ({
        url: `/lab-orders/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "LabOrder", id },
        { type: "LabOrder", id: "LIST" },
        { type: "Dashboard", id: "OVERVIEW" },
      ],
    }),
  }),
});

export const {
  useGetLabOrdersQuery,
  useGetLabOrderByIdQuery,
  useCreateLabOrderMutation,
  useUpdateLabOrderMutation,
} = labOrderApi;
