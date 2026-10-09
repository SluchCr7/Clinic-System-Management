import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse, ApiMessageResponse } from "@/types/api";
import type {
  Schedule,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  ScheduleQueryParams,
} from "@/types/schedule";

export const scheduleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSchedules: builder.query<PaginatedResponse<Schedule>, ScheduleQueryParams | void>({
      query: (params) => ({
        url: "/schedules",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "Schedule", id: "LIST" },
              ...result.data.map(({ _id }) => ({ type: "Schedule" as const, id: _id })),
            ]
          : [{ type: "Schedule", id: "LIST" }],
    }),

    getScheduleById: builder.query<ApiResponse<Schedule>, string>({
      query: (id) => ({
        url: `/schedules/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Schedule", id }],
    }),

    createSchedule: builder.mutation<ApiResponse<Schedule>, CreateScheduleRequest>({
      query: (body) => ({
        url: "/schedules",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Schedule", id: "LIST" }],
    }),

    updateSchedule: builder.mutation<
      ApiResponse<Schedule>,
      { id: string; data: UpdateScheduleRequest }
    >({
      query: ({ id, data }) => ({
        url: `/schedules/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Schedule", id },
        { type: "Schedule", id: "LIST" },
      ],
    }),

    deactivateSchedule: builder.mutation<ApiMessageResponse, string>({
      query: (id) => ({
        url: `/schedules/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Schedule", id },
        { type: "Schedule", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetSchedulesQuery,
  useGetScheduleByIdQuery,
  useCreateScheduleMutation,
  useUpdateScheduleMutation,
  useDeactivateScheduleMutation,
} = scheduleApi;
