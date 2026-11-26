import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  LabOrder,
  GroupedLabOrderCard,
  LabOrderItem,
  PendingOrderItem,
  CreateLabOrderRequest,
  UpdateLabOrderRequest,
  UpdateLabOrderItemRequest,
  GroupedLabOrderQueryParams,
  LabOrderQueryParams,
} from "@/types/labOrder";

export const labOrderApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getGroupedLabOrders: builder.query<
      PaginatedResponse<GroupedLabOrderCard>,
      GroupedLabOrderQueryParams | void
    >({
      query: (params) => ({
        url: "/lab-orders/grouped",
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

    getLabOrders: builder.query<
      PaginatedResponse<GroupedLabOrderCard>,
      GroupedLabOrderQueryParams | void
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

    getPendingOrdersByPatient: builder.query<
      ApiResponse<PendingOrderItem[]>,
      { patientId: string; currentVisitId?: string }
    >({
      query: ({ patientId, currentVisitId }) => ({
        url: `/lab-orders/pending/${patientId}`,
        method: "GET",
        params: currentVisitId ? { currentVisitId } : undefined,
      }),
      providesTags: [{ type: "LabOrder", id: "PENDING" }],
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
        { type: "LabOrder", id: "PENDING" },
        { type: "Dashboard", id: "OVERVIEW" },
      ],
    }),

    updateLabOrderItem: builder.mutation<
      ApiResponse<{ item: LabOrderItem; orderId: string }>,
      { id: string; data: FormData | UpdateLabOrderItemRequest }
    >({
      query: ({ id, data }) => ({
        url: `/lab-order-items/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: [
        { type: "LabOrder", id: "LIST" },
        { type: "LabOrder", id: "PENDING" },
        { type: "Dashboard", id: "OVERVIEW" },
      ],
    }),

    deleteLabOrderItemFile: builder.mutation<
      ApiResponse<{ success: boolean }>,
      { itemId: string; fileId: string }
    >({
      query: ({ itemId, fileId }) => ({
        url: `/lab-order-items/${itemId}/files/${fileId}`,
        method: "DELETE",
      }),
      invalidatesTags: [
        { type: "LabOrder", id: "LIST" },
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
        { type: "LabOrder", id: "PENDING" },
        { type: "Dashboard", id: "OVERVIEW" },
      ],
    }),
  }),
});

export const {
  useGetGroupedLabOrdersQuery,
  useGetLabOrdersQuery,
  useGetLabOrderByIdQuery,
  useGetPendingOrdersByPatientQuery,
  useCreateLabOrderMutation,
  useUpdateLabOrderItemMutation,
  useDeleteLabOrderItemFileMutation,
  useUpdateLabOrderMutation,
} = labOrderApi;
