import { BaseListQueryParams } from "./api";
import { Visit } from "./visit";
import { Patient } from "./patient";
import { Doctor } from "./doctor";

export type MedicationRoute =
  | "oral"
  | "topical"
  | "injection"
  | "inhalation"
  | "ophthalmic"
  | "otic"
  | "nasal"
  | "rectal"
  | "other";

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route?: MedicationRoute;
  instructions?: string | null;
}

export interface Prescription {
  _id: string;
  visit: Visit | string;
  patient: Patient | string;
  doctor: Doctor | string;
  medications: Medication[];
  generalInstructions?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrescriptionRequest {
  visit: string;
  patient: string;
  doctor: string;
  medications: Medication[];
  generalInstructions?: string | null;
  notes?: string | null;
}

export interface UpdatePrescriptionRequest {
  medications?: Medication[];
  generalInstructions?: string | null;
  notes?: string | null;
}

export interface PrescriptionQueryParams extends Omit<BaseListQueryParams, "search"> {
  patient?: string;
  doctor?: string;
  visit?: string;
}
