import { BaseListQueryParams } from "./api";
import { Visit } from "./visit";
import { Patient } from "./patient";
import { Doctor } from "./doctor";

export type InvoiceStatus =
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "cancelled";

export interface InvoiceItem {
  type?: "consultation" | "performed_service";
  performedService?: string | null;
  serviceId?: string | null;
  serviceName: string;
  name?: string;
  serviceCode: string;
  code?: string;
  category?: string | null;
  unitPrice: number;
  quantity: number;
  discount: number;
  total: number;
  lineTotal?: number;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  visit: Visit | string;
  patient: Patient | string;
  doctor: Doctor | string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  notes?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceServiceItem {
  serviceId: string;
  quantity: number;
  discount?: number;
}

export interface CreateInvoiceRequest {
  visit: string;
  services?: InvoiceServiceItem[];
  discount?: number;
  tax?: number;
  notes?: string | null;
}

export interface UpdateInvoiceRequest {
  services?: InvoiceServiceItem[];
  discount?: number;
  tax?: number;
  notes?: string | null;
}

export interface InvoiceQueryParams extends BaseListQueryParams {
  patient?: string;
  doctor?: string;
  visit?: string;
  status?: InvoiceStatus;
}
