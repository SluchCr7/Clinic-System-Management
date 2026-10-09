import { BaseListQueryParams } from "./api";
import { User } from "./auth";

export interface Doctor {
  _id: string;
  user: User | string;
  specialization: string;
  licenseNumber: string;
  consultationFee: number;
  bio?: string | null;
  yearsOfExperience: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDoctorRequest {
  user: string;
  specialization: string;
  licenseNumber: string;
  consultationFee: number;
  bio?: string | null;
  yearsOfExperience?: number;
}

export interface UpdateDoctorRequest {
  specialization?: string;
  licenseNumber?: string;
  consultationFee?: number;
  bio?: string | null;
  yearsOfExperience?: number;
  isActive?: boolean;
}

export interface DoctorQueryParams extends BaseListQueryParams {
  specialization?: string;
  isActive?: boolean;
}
