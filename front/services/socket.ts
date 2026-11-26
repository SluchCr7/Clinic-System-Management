import { io } from "socket.io-client";
import { store } from "@/redux/store";
import { notificationApi } from "@/services/api/notificationApi";
const getSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL_SOCKET) {
    return process.env.NEXT_PUBLIC_API_URL_SOCKET;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, "");
  }
  return "http://localhost:3001";
};

export const socket = io(getSocketUrl(), {
  autoConnect: false,
  withCredentials: true,
});

socket.on("connect", () => {
  console.log("🟢 Socket connected:", socket.id);
});
socket.on("notification:new", (data) => {
  console.log("🔔 New notification:", data);

  const notification = data.notification;

  // Update unread count immediately
  store.dispatch(
    notificationApi.util.updateQueryData(
      "getUnreadCount",
      undefined,
      (draft) => {
        draft.data.unreadCount += 1;
      }
    )
  );

  // Update the default notifications list immediately
  store.dispatch(
    notificationApi.util.updateQueryData(
      "getNotifications",
      {
        page: 1,
        limit: 20,
        isRead: undefined,
        type: undefined,
      },
      (draft) => {
        draft.data.unshift(notification);
        draft.pagination.total += 1;

        if (draft.data.length > 20) {
          draft.data.pop();
        }
      }
    )
  );
});
socket.on("disconnect", (reason) => {
  console.log("🔴 Socket disconnected:", reason);
});