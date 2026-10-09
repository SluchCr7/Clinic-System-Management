import type { RootState } from "@/redux/store";

export const selectRealtimeNotifications = (
  state: RootState
) => state.notifications.realtimeNotifications;