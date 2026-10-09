import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  Visit,
  CreateVisitRequest,
  UpdateVisitRequest,
  VisitQueryParams,
} from "@/types/visit";

export const visitApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVisits: builder.query<PaginatedResponse<Visit>, VisitQueryParams | void>({
      query: (params) => ({
        url: "/visits",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "Visit", id: "LIST" },
              ...result.data.map(({ _id }) => ({ type: "Visit" as const, id: _id })),
            ]
          : [{ type: "Visit", id: "LIST" }],
    }),

    getVisitById: builder.query<ApiResponse<Visit>, string>({
      query: (id) => ({
        url: `/visits/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Visit", id }],
    }),

    createVisit: builder.mutation<ApiResponse<Visit>, CreateVisitRequest>({
      query: (body) => ({
        url: "/visits",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Visit", id: "LIST" },
        { type: "Appointment", id: "LIST" },
        { type: "Dashboard", id: "OVERVIEW" },
      ],
    }),

    updateVisit: builder.mutation<
      ApiResponse<Visit>,
      { id: string; data: UpdateVisitRequest }
    >({
      query: ({ id, data }) => ({
        url: `/visits/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Visit", id },
        { type: "Visit", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetVisitsQuery,
  useGetVisitByIdQuery,
  useCreateVisitMutation,
  useUpdateVisitMutation,
} = visitApi;
