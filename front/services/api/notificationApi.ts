import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse, ApiMessageResponse } from "@/types/api";
import type {
  Notification,
  CreateNotificationRequest,
  NotificationQueryParams,
  UnreadCountResponseData,
} from "@/types/notification";

export const notificationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<
      PaginatedResponse<Notification>,
      NotificationQueryParams | void
    >({
      query: (params) => ({
        url: "/notifications",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      keepUnusedDataFor: 60,
      providesTags: (result) =>
        result
          ? [
              { type: "Notification", id: "LIST" },
              ...result.data.map(({ _id }) => ({
                type: "Notification" as const,
                id: _id,
              })),
            ]
          : [{ type: "Notification", id: "LIST" }],
    }),

    getUnreadCount: builder.query<ApiResponse<UnreadCountResponseData>, void>({
      query: () => ({
        url: "/notifications/unread-count",
        method: "GET",
      }),
      keepUnusedDataFor: 60,
      providesTags: [{ type: "Notification", id: "UNREAD_COUNT" }],
    }),

    getNotificationById: builder.query<ApiResponse<Notification>, string>({
      query: (id) => ({
        url: `/notifications/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Notification", id }],
    }),

    createNotification: builder.mutation<
      ApiResponse<Notification>,
      CreateNotificationRequest
    >({
      query: (body) => ({
        url: "/notifications",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Notification", id: "LIST" },
        { type: "Notification", id: "UNREAD_COUNT" },
      ],
    }),

    markAsRead: builder.mutation<ApiResponse<Notification>, string>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: "PATCH",
        body: { isRead: true },
      }),

      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          const updatedNotification = data.data;

          // Update notification lists
          dispatch(
            notificationApi.util.updateQueryData(
              "getNotifications",
              {
                page: 1,
                limit: 20,
                isRead: undefined,
                type: undefined,
              },
              (draft) => {
                const notification = draft.data.find(
                  (item) => item._id === id
                );

                if (notification) {
                  notification.isRead = true;
                  notification.readAt =
                    updatedNotification.readAt;
                }
              }
            )
          );

          // Update unread count
          dispatch(
            notificationApi.util.updateQueryData(
              "getUnreadCount",
              undefined,
              (draft) => {
                draft.data.unreadCount = Math.max(
                  0,
                  draft.data.unreadCount - 1
                );
              }
            )
          );
        } catch {
          // Keep RTK Query's normal error handling.
        }
      },

      invalidatesTags: (_result, _error, id) => [
        { type: "Notification", id },
        { type: "Notification", id: "LIST" },
        { type: "Notification", id: "UNREAD_COUNT" },
      ],
    }),

    markAllAsRead: builder.mutation<ApiMessageResponse, void>({
      query: () => ({
        url: "/notifications/read-all",
        method: "PATCH",
      }),
      invalidatesTags: [
        { type: "Notification", id: "LIST" },
        { type: "Notification", id: "UNREAD_COUNT" },
      ],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useGetNotificationByIdQuery,
  useCreateNotificationMutation,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} = notificationApi;
