import { BaseListQueryParams } from "./api";
import { Invoice } from "./invoice";
import { Patient } from "./patient";

export type PaymentMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "online"
  | "insurance";

export interface Payment {
  _id: string;
  invoice: Invoice | string;
  patient: Patient | string;
  amount: number;
  method: PaymentMethod;
  transactionReference?: string | null;
  paidAt: string;
  receivedBy: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  invoice: string;
  amount: number;
  method: PaymentMethod;
  transactionReference?: string | null;
  notes?: string | null;
  paidAt?: string;
}

export interface PaymentQueryParams extends Omit<BaseListQueryParams, "search"> {
  invoice?: string;
  patient?: string;
  method?: PaymentMethod;
}
