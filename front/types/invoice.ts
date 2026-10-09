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
  service: string;
  name: string;
  price: number;
  quantity: number;
  discount: number;
  total: number;
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

export interface CreateInvoiceRequest {
  visit: string;
  discount?: number;
  tax?: number;
  notes?: string | null;
}

export interface UpdateInvoiceRequest {
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
