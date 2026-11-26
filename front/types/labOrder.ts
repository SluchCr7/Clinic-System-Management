import { BaseListQueryParams } from "./api";
import { Visit } from "./visit";
import { Patient } from "./patient";
import { Doctor } from "./doctor";

export type LabOrderPriority = "routine" | "urgent" | "stat";
export type LabOrderType = "lab" | "radiology" | "LAB" | "IMAGING";
export type LabOrderStatus =
  | "ordered"
  | "received"
  | "cancelled"
  | "REQUESTED"
  | "RESULT_RECEIVED"
  | "CANCELLED";

export interface LabResultFile {
  _id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  path?: string;
  uploadedAt: string;
}

export interface LabOrderItem {
  _id: string;
  type: "lab" | "radiology" | "LAB" | "IMAGING";
  name: string;
  code?: string;
  instructions?: string;
  status: "ordered" | "received" | "cancelled" | "REQUESTED" | "RESULT_RECEIVED" | "CANCELLED";
  labName?: string;
  resultNotes?: string;
  resultFiles?: LabResultFile[];
  receivedAt?: string;
  cancelReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GroupedLabOrderCard {
  _id: string;
  clinicId: string;
  visitId: string;
  patientId: string;
  prescriptionId?: string;
  priority: LabOrderPriority;
  createdAt: string;
  patient: {
    _id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    gender?: string;
    dateOfBirth?: string;
  };
  visit: {
    _id: string;
    status: string;
    createdAt: string;
    appointmentDate?: string;
    chiefComplaint?: string;
  };
  counts: {
    total: number;
    pending: number;
    received: number;
    cancelled: number;
  };
  hasPending: boolean;
  items: LabOrderItem[];
  // Backward compatibility fields
  type?: any;
  status?: any;
  tests?: any[];
  orderedAt?: string;
  doctor?: any;
}

export interface PendingOrderItem {
  orderId: string;
  itemId: string;
  type: "lab" | "radiology";
  name: string;
  code?: string;
  priority: "routine" | "urgent";
  orderedAt: string;
  visitId: string;
  visitDate: string;
  labName?: string;
  resultNotes?: string;
}

export interface CreateLabOrderRequest {
  type?: LabOrderType;
  visit?: string;
  visitId?: string;
  patient?: string;
  patientId?: string;
  doctor?: string;
  priority?: LabOrderPriority;
  items?: Array<{
    name: string;
    type?: "lab" | "radiology";
    code?: string;
    instructions?: string;
  }>;
  tests?: Array<{
    name: string;
    code?: string;
    instructions?: string;
  }>;
  reason?: string;
  notes?: string;
  orderedAt?: string;
}

export interface UpdateLabOrderItemRequest {
  status: "ordered" | "received" | "cancelled" | "REQUESTED" | "RESULT_RECEIVED" | "CANCELLED";
  labName?: string;
  resultNotes?: string;
  cancelReason?: string;
  receivedAt?: string;
}

export interface GroupedLabOrderQueryParams {
  page?: number;
  limit?: number;
  filter?: "pending" | "all";
  status?: string;
  type?: string;
  priority?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  visit?: string;
  patient?: string;
  doctor?: string;
}

export interface LabTest {
  name: string;
  code?: string;
  instructions?: string;
}

export interface LabOrder {
  _id: string;
  type: LabOrderType;
  visit: Visit | string;
  patient: Patient | string;
  doctor: Doctor | string;
  tests: LabTest[];
  items?: LabOrderItem[];
  reason?: string;
  priority: LabOrderPriority;
  status: LabOrderStatus;
  notes?: string;
  orderedAt: string;
  requestedAt?: string;
  requestedBy?: string | { firstName: string; lastName: string };
  instructions?: string;
  clinicalNotes?: string;
  expectedBy?: string;
  receivedAt?: string;
  receivedBy?: string;
  performedAt?: string;
  externalFacilityName?: string;
  resultNotes?: string;
  resultAttachment?: string;
  statusChangeReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLabOrderRequest {
  tests?: LabTest[];
  items?: LabOrderItem[];
  reason?: string;
  priority?: LabOrderPriority;
  status?: LabOrderStatus;
  notes?: string;
  orderedAt?: string;
  type?: LabOrderType;
  instructions?: string;
  clinicalNotes?: string;
  expectedBy?: string;
  receivedAt?: string;
  performedAt?: string;
  externalFacilityName?: string;
  resultNotes?: string;
  resultAttachment?: string;
  statusChangeReason?: string;
}

export interface LabOrderQueryParams extends BaseListQueryParams {
  visit?: string;
  patient?: string;
  doctor?: string;
  status?: LabOrderStatus;
  priority?: LabOrderPriority;
}
