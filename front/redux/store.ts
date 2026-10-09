import { configureStore } from "@reduxjs/toolkit";
import { baseApi } from "@/services/api/baseApi";
import authReducer from "@/features/auth/authSlice";
import notificationReducer from "../features/notifications/notificationSlice";
export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;