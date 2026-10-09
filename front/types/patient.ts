import { BaseListQueryParams } from "./api";

export type Gender = "male" | "female";
export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export interface PatientAddress {
  street?: string;
  city?: string;
  country?: string;
}

export interface EmergencyContact {
  name?: string;
  phone?: string;
  relationship?: string;
}

export interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email?: string | null;
  bloodType?: BloodType;
  allergies: string[];
  chronicDiseases: string[];
  address?: PatientAddress;
  emergencyContact?: EmergencyContact;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email?: string | null;
  bloodType?: BloodType;
  allergies?: string[];
  chronicDiseases?: string[];
  address?: PatientAddress;
  emergencyContact?: EmergencyContact;
}

export interface UpdatePatientRequest {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  phone?: string;
  email?: string | null;
  bloodType?: BloodType;
  allergies?: string[];
  chronicDiseases?: string[];
  address?: PatientAddress;
  emergencyContact?: EmergencyContact;
  isActive?: boolean;
}

export interface PatientQueryParams extends BaseListQueryParams {
  gender?: Gender;
  bloodType?: BloodType;
  isActive?: boolean;
}
