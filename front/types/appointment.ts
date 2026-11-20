import { BaseListQueryParams } from "./api";
import { Patient } from "./patient";
import { Doctor } from "./doctor";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no-show";

export interface Appointment {
  _id: string;
  patient: Patient | string;
  doctor: Doctor | string;
  appointmentDate: string;
  duration: number;
  status: AppointmentStatus;
  checkedInAt?: string | null;
  noShowEligibleAt?: string | null;
  reason?: string | null;
  notes?: string | null;
  cancellationReason?: string | null;
  isFollowUp?: boolean;
  followUpReason?: string | null;
  originatingVisit?: string | null;
  followUpOf?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentRequest {
  patient: string;
  doctor: string;
  appointmentDate: string;
  duration?: number;
  reason?: string | null;
  notes?: string | null;
  isFollowUp?: boolean;
  followUpReason?: string;
  originatingVisit?: string;
  followUpOf?: string;
}

export interface UpdateAppointmentRequest {
  appointmentDate?: string;
  duration?: number;
  reason?: string | null;
  notes?: string | null;
  status?: AppointmentStatus;
  cancellationReason?: string | null;
}

export interface AppointmentQueryParams extends Omit<BaseListQueryParams, "search"> {
  patient?: string;
  doctor?: string;
  originatingVisit?: string;
  status?: AppointmentStatus;
}
