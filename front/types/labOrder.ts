import { BaseListQueryParams } from "./api";
import { Visit } from "./visit";
import { Patient } from "./patient";
import { Doctor } from "./doctor";

export type LabOrderPriority = "routine" | "urgent" | "stat";
export type LabOrderType = "LAB" | "IMAGING";
export type LabOrderStatus =
  | "REQUESTED"
  | "RESULT_RECEIVED"
  | "CANCELLED";

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

export interface CreateLabOrderRequest {
  type?: LabOrderType;
  visit: string;
  patient: string;
  doctor: string;
  tests: LabTest[];
  reason?: string;
  priority?: LabOrderPriority;
  notes?: string;
  orderedAt?: string;
  instructions?: string;
  clinicalNotes?: string;
  expectedBy?: string;
}

export interface UpdateLabOrderRequest {
  tests?: LabTest[];
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
