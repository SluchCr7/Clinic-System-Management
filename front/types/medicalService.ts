import { BaseListQueryParams } from "./api";

export interface PriceHistoryItem {
  price: number;
  changedAt: string;
  changedBy?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  } | string | null;
}

export interface MedicalService {
  _id: string;
  doctor?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  } | string;
  name: string;
  code: string;
  description?: string | null;
  category: string;
  price: number;
  duration: number;
  isActive: boolean;
  notes?: string | null;
  priceHistory?: PriceHistoryItem[];
  createdBy?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  } | string;
  updatedBy?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  } | string | null;
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
  notes?: string | null;
  isActive?: boolean;
  doctor?: string;
}

export interface UpdateMedicalServiceRequest {
  name?: string;
  code?: string;
  description?: string | null;
  category?: string;
  price?: number;
  duration?: number;
  notes?: string | null;
  isActive?: boolean;
  doctor?: string;
}

export interface MedicalServiceQueryParams extends BaseListQueryParams {
  category?: string;
  isActive?: boolean;
  doctor?: string;
}
