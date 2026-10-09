import { BaseListQueryParams } from "./api";
import { Patient } from "./patient";
import { Visit } from "./visit";
import { User } from "./auth";

export type MedicalAttachmentType =
  | "lab_report"
  | "xray"
  | "prescription"
  | "medical_report"
  | "other";

export interface AttachmentFileInfo {
  url: string;
  publicId?: string | null;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface MedicalAttachment {
  _id: string;
  patient: Patient | string;
  visit?: Visit | string | null;
  uploadedBy: User | string;
  file: AttachmentFileInfo;
  type: MedicalAttachmentType;
  title: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicalAttachmentRequest {
  patient: string;
  visit?: string;
  type: MedicalAttachmentType;
  title: string;
  description?: string;
  file: File;
}

export interface MedicalAttachmentQueryParams extends BaseListQueryParams {
  patient: string; // Required by backend
  visit?: string;
  type?: MedicalAttachmentType;
}
