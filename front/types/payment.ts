import { BaseListQueryParams } from "./api";
import { Invoice } from "./invoice";
import { Patient } from "./patient";

export type PaymentMethodCode =
  | "cash"
  | "card"
  | "vodafone_cash"
  | "bank_transfer"
  | "online"
  | "insurance"
  | string;

export type PaymentMethod = PaymentMethodCode;

export interface PaymentMethodItem {
  _id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  requiresReference: boolean;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentStaff {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role?: string;
}

export interface Payment {
  _id: string;
  invoice: Invoice | string;
  patient: Patient | string;
  amount: number;
  paymentMethod?: PaymentMethodItem | string | null;
  method: PaymentMethodCode;
  referenceNumber?: string | null;
  transactionReference?: string | null;
  paidAt: string;
  receivedBy?: PaymentStaff | string;
  createdBy?: PaymentStaff | string;
  notes?: string | null;
  idempotencyKey?: string | null;
  isReversal?: boolean;
  reversedPayment?: string | null;
  reversalReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  invoice: string;
  amount: number;
  paymentMethod?: string;
  method?: string;
  referenceNumber?: string | null;
  transactionReference?: string | null;
  notes?: string | null;
  paidAt?: string;
  idempotencyKey?: string;
}

export interface PaymentQueryParams extends Omit<BaseListQueryParams, "search"> {
  invoice?: string;
  patient?: string;
  method?: string;
  paymentMethod?: string;
}

export interface DailyClosingMethodTotal {
  _id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  totalAmount: number;
  count: number;
}

export interface DailyClosingStaffTotal {
  _id: string;
  staffName: string;
  staffEmail?: string;
  staffRole?: string;
  totalAmount: number;
  totalTransactions: number;
  byMethod: DailyClosingMethodTotal[];
}

export interface DailyClosingReport {
  dateRange: {
    start: string;
    end: string;
  };
  totalCollected: number;
  totalTransactions: number;
  reversalsCount: number;
  totalsByMethod: DailyClosingMethodTotal[];
  totalsByReceptionist: DailyClosingStaffTotal[];
}
