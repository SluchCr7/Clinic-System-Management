import { BaseListQueryParams } from "./api";
import { Appointment } from "./appointment";
import { Patient } from "./patient";
import { Doctor } from "./doctor";

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
  chiefComplaint: string;
  symptoms: string[];
  vitals?: Vitals;
  examination?: string | null;
  diagnosis: string[];
  doctorNotes?: string | null;
  followUpDate?: string | null;
  createdAt: string;
  updatedAt: string;
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
}

export interface UpdateVisitRequest {
  chiefComplaint?: string;
  symptoms?: string[];
  vitals?: Vitals;
  examination?: string | null;
  diagnosis?: string[];
  doctorNotes?: string | null;
  followUpDate?: string | null;
}

export interface VisitQueryParams extends Omit<BaseListQueryParams, "search"> {
  patient?: string;
  doctor?: string;
}
