import { BaseListQueryParams } from "./api";
import { Patient } from "./patient";
import { Doctor } from "./doctor";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
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
  reason?: string | null;
  notes?: string | null;
  cancellationReason?: string | null;
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
  status?: AppointmentStatus;
}
