import { BaseListQueryParams } from "./api";

export interface MedicalService {
  _id: string;
  name: string;
  code: string;
  description?: string | null;
  category: string;
  price: number;
  duration: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicalServiceRequest {
  name: string;
  code: string;
  description?: string | null;
  category: string;
  price: number;
  duration?: number;
}

export interface UpdateMedicalServiceRequest {
  name?: string;
  description?: string | null;
  category?: string;
  price?: number;
  duration?: number;
  isActive?: boolean;
}

export interface MedicalServiceQueryParams extends BaseListQueryParams {
  category?: string;
  isActive?: boolean;
}
