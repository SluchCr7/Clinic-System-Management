import { BaseListQueryParams } from "./api";
import { Visit } from "./visit";
import { Patient } from "./patient";
import { Doctor } from "./doctor";

export type LabOrderPriority = "routine" | "urgent" | "stat";
export type LabOrderStatus =
  | "ordered"
  | "sample_collected"
  | "processing"
  | "completed"
  | "cancelled";

export interface LabTest {
  name: string;
  code?: string;
  instructions?: string;
}

export interface LabOrder {
  _id: string;
  visit: Visit | string;
  patient: Patient | string;
  doctor: Doctor | string;
  tests: LabTest[];
  reason?: string;
  priority: LabOrderPriority;
  status: LabOrderStatus;
  notes?: string;
  orderedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabOrderRequest {
  visit: string;
  patient: string;
  doctor: string;
  tests: LabTest[];
  reason?: string;
  priority?: LabOrderPriority;
  notes?: string;
  orderedAt?: string;
}

export interface UpdateLabOrderRequest {
  tests?: LabTest[];
  reason?: string;
  priority?: LabOrderPriority;
  status?: LabOrderStatus;
  notes?: string;
  orderedAt?: string;
}

export interface LabOrderQueryParams extends BaseListQueryParams {
  visit?: string;
  patient?: string;
  doctor?: string;
  status?: LabOrderStatus;
  priority?: LabOrderPriority;
}
