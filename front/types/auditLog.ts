import { BaseListQueryParams } from "./api";
import { User } from "./auth";

export interface AuditLog {
  _id: string;
  actor: User | string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAuditLogRequest {
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

export interface AuditLogQueryParams extends Omit<BaseListQueryParams, "search"> {
  actor?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
}
