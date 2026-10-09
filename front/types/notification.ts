import { BaseListQueryParams } from "./api";
import { User } from "./auth";

export type NotificationType =
  | "appointment"
  | "lab_order"
  | "payment"
  | "prescription"
  | "medical_attachment"
  | "system";

export type NotificationRelatedModel =
  | "Appointment"
  | "LabOrder"
  | "Payment"
  | "Prescription"
  | "MedicalAttachment";

export interface Notification {
  _id: string;
  recipient: User | string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string | null;
  relatedModel?: NotificationRelatedModel;
  relatedId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationRequest {
  recipient: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedModel?: NotificationRelatedModel;
  relatedId?: string;
}

export interface NotificationQueryParams extends BaseListQueryParams {
  isRead?: boolean;
  type?: NotificationType;
}

export interface UnreadCountResponseData {
  unreadCount: number;
}
