import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  AuditLog,
  CreateAuditLogRequest,
  AuditLogQueryParams,
} from "@/types/auditLog";

export const auditLogApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAuditLogs: builder.query<
      PaginatedResponse<AuditLog>,
      AuditLogQueryParams | void
    >({
      query: (params) => ({
        url: "/audit-logs",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      keepUnusedDataFor: 60,
      providesTags: (result) =>
        result
          ? [
              { type: "AuditLog", id: "LIST" },
              ...result.data.map(({ _id }) => ({
                type: "AuditLog" as const,
                id: _id,
              })),
            ]
          : [{ type: "AuditLog", id: "LIST" }],
    }),

    getAuditLogById: builder.query<ApiResponse<AuditLog>, string>({
      query: (id) => ({
        url: `/audit-logs/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "AuditLog", id }],
    }),

    createAuditLog: builder.mutation<
      ApiResponse<AuditLog>,
      CreateAuditLogRequest
    >({
      query: (body) => ({
        url: "/audit-logs",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "AuditLog", id: "LIST" }],
    }),
  }),
});

export const {
  useGetAuditLogsQuery,
  useGetAuditLogByIdQuery,
  useCreateAuditLogMutation,
} = auditLogApi;
