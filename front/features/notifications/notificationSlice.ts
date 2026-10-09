import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Notification {
  _id: string;
  recipient: string;
  type:
    | "appointment"
    | "lab_order"
    | "payment"
    | "prescription"
    | "medical_attachment"
    | "system";
  title: string;
  message: string;
  relatedModel:
    | "Appointment"
    | "LabOrder"
    | "Payment"
    | "Prescription"
    | "MedicalAttachment"
    | null;
  relatedId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotificationState {
  realtimeNotifications: Notification[];
}

const initialState: NotificationState = {
  realtimeNotifications: [],
};

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    addRealtimeNotification: (
      state,
      action: PayloadAction<Notification>
    ) => {
      state.realtimeNotifications.unshift(action.payload);
    },

    clearRealtimeNotifications: (state) => {
      state.realtimeNotifications = [];
    },
  },
});

export const {
  addRealtimeNotification,
  clearRealtimeNotifications,
} = notificationSlice.actions;

export default notificationSlice.reducer;