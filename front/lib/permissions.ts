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
  | "laboratory.manage"
  | "billing.view"
  | "billing.manage"
  | "medicalServices.manage"
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
    "laboratory.manage",
    "billing.view",
    "billing.manage",
    "medicalServices.manage",
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
    "laboratory.manage",
    "billing.view",
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
    "prescriptions.view",
    "billing.view",
    "billing.manage",
    "notifications.view",
    "settings.view",
  ],
};

export function getRequiredRoutePermission(pathname: string): Permission | null {
  if (pathname === "/dashboard") return "dashboard.view";
  if (pathname === "/patients/new") return "patients.create";
  if (pathname.startsWith("/patients")) return "patients.view";
  if (pathname.startsWith("/doctors")) return "doctors.view";
  if (pathname.startsWith("/appointments")) return "appointments.view";
  if (pathname === "/visits/new") return "visits.create";
  if (pathname.startsWith("/visits")) return "visits.view";
  if (pathname.startsWith("/prescriptions")) return "prescriptions.view";
  if (pathname.startsWith("/lab-orders")) return "laboratory.view";
  if (pathname.startsWith("/invoices") || pathname.startsWith("/payments")) {
    return "billing.view";
  }
  if (pathname.startsWith("/reports")) return "reports.view";
  if (pathname.startsWith("/users")) return "users.manage";
  if (pathname.startsWith("/audit-logs")) return "auditLogs.view";
  if (pathname.startsWith("/notifications")) return "notifications.view";
  if (pathname.startsWith("/settings")) return "settings.view";
  return null;
}

export function hasPermission(
  role: UserRole | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
