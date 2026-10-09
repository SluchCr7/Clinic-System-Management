import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQuery";

export const TAG_TYPES = [
  "Auth",
  "User",
  "Patient",
  "Doctor",
  "Schedule",
  "Appointment",
  "Visit",
  "Prescription",
  "MedicalService",
  "PerformedService",
  "Invoice",
  "Payment",
  "MedicalAttachment",
  "LabOrder",
  "Notification",
  "ReminderSettings",
  "AuditLog",
  "Dashboard",
  "Search",
] as const;

export type TagType = (typeof TAG_TYPES)[number];

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: TAG_TYPES,
  refetchOnFocus: false,
  refetchOnReconnect: true,
  keepUnusedDataFor: 300, // 5 minutes default
  endpoints: () => ({}),
});