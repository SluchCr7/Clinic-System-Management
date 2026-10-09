import type { UserRole } from "@/types/auth";

export type Permission =
  | "dashboard.view"
  | "patients.view"
  | "patients.create"
  | "patients.edit"
  | "patients.delete"
  | "doctors.view"
  | "doctors.manage"
  | "appointments.view"
  | "appointments.create"
  | "appointments.edit"
  | "visits.view"
  | "visits.create"
  | "prescriptions.view"
  | "prescriptions.create"
  | "laboratory.view"
  | "laboratory.create"
  | "billing.view"
  | "billing.manage"
  | "reports.view"
  | "users.manage"
  | "auditLogs.view"
  | "notifications.view"
  | "settings.view";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "dashboard.view",
    "patients.view",
    "patients.create",
    "patients.edit",
    "patients.delete",
    "doctors.view",
    "doctors.manage",
    "appointments.view",
    "appointments.create",
    "appointments.edit",
    "visits.view",
    "visits.create",
    "prescriptions.view",
    "prescriptions.create",
    "laboratory.view",
    "laboratory.create",
    "billing.view",
    "billing.manage",
    "reports.view",
    "users.manage",
    "auditLogs.view",
    "notifications.view",
    "settings.view",
  ],
  doctor: [
    "dashboard.view",
    "patients.view",
    "doctors.view",
    "appointments.view",
    "visits.view",
    "visits.create",
    "prescriptions.view",
    "prescriptions.create",
    "laboratory.view",
    "laboratory.create",
    "billing.view",
    "reports.view",
    "notifications.view",
    "settings.view",
  ],
  receptionist: [
    "dashboard.view",
    "patients.view",
    "patients.create",
    "patients.edit",
    "doctors.view",
    "appointments.view",
    "appointments.create",
    "appointments.edit",
    "visits.view",
    "prescriptions.view",
    "laboratory.view",
    "billing.view",
    "billing.manage",
    "notifications.view",
    "settings.view",
  ],
};

export function hasPermission(
  role: UserRole | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
