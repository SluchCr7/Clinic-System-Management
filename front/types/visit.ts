import { BaseListQueryParams } from "./api";
import { Appointment } from "./appointment";
import { Patient } from "./patient";
import { Doctor } from "./doctor";

export type VisitStatus = "in_progress" | "completed";

export interface VitalsBloodPressure {
  systolic?: number;
  diastolic?: number;
}

export interface Vitals {
  temperature?: number;
  bloodPressure?: VitalsBloodPressure;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
}

export interface Visit {
  _id: string;
  appointment: Appointment | string;
  patient: Patient | string;
  doctor: Doctor | string;
  status: VisitStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  statusHistory: Array<{
    from: VisitStatus | null;
    to: VisitStatus;
    changedBy: string;
    changedAt: string;
  }>;
  chiefComplaint: string;
  symptoms: string[];
  vitals?: Vitals;
  examination?: string | null;
  diagnosis: string[];
  doctorNotes?: string | null;
  followUpDate?: string | null;
  followUpReason?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string | null;
}

export interface CreateVisitRequest {
  appointment: string;
  patient: string;
  doctor: string;
  chiefComplaint: string;
  symptoms?: string[];
  vitals?: Vitals;
  examination?: string | null;
  diagnosis?: string[];
  doctorNotes?: string | null;
  followUpDate?: string | null;
  followUpReason?: string | null;
}

export interface UpdateVisitRequest {
  chiefComplaint?: string;
  symptoms?: string[];
  vitals?: Vitals;
  examination?: string | null;
  diagnosis?: string[];
  doctorNotes?: string | null;
  followUpDate?: string | null;
  followUpReason?: string | null;
}

export interface VisitQueryParams extends Omit<BaseListQueryParams, "search"> {
  patient?: string;
  doctor?: string;
  appointment?: string;
  status?: VisitStatus;
}
