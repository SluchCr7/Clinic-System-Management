import { BaseListQueryParams } from "./api";
import { Visit } from "./visit";
import { Patient } from "./patient";
import { Doctor } from "./doctor";
import { MedicalService } from "./medicalService";

export interface PerformedService {
  _id: string;
  visit: Visit | string;
  patient: Patient | string;
  doctor: Doctor | string;
  service: MedicalService | string;
  serviceName: string;
  serviceCode: string;
  price: number;
  quantity: number;
  discount: number;
  total: number;
  notes?: string | null;
  performedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePerformedServiceRequest {
  visit: string;
  patient: string;
  doctor: string;
  service: string;
  quantity?: number;
  discount?: number;
  notes?: string | null;
  performedAt?: string;
}

export interface UpdatePerformedServiceRequest {
  quantity?: number;
  discount?: number;
  notes?: string | null;
  performedAt?: string;
}

export interface PerformedServiceQueryParams extends BaseListQueryParams {
  patient?: string;
  doctor?: string;
  visit?: string;
  service?: string;
}
