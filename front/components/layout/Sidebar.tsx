"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { usePathname } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { selectUserRole } from "@/features/auth/authSelectors";
import { useGetUnreadCountQuery } from "@/services/api/notificationApi";
import Logo from "@/components/ui/Logo";
import {
  LuLayoutDashboard,
  LuUsers,
  LuStethoscope,
  LuCalendar,
  LuClipboardCheck,
  LuFileText,
  LuFlaskConical,
  LuReceipt,
  LuCreditCard,
  LuActivity,
  LuChartBar,
  LuShieldCheck,
  LuScrollText,
  LuBell,
  LuSettings,
  LuPanelLeftClose,
  LuPanelLeft,
} from "react-icons/lu";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  roles?: Array<"admin" | "doctor" | "receptionist">;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const role = useAppSelector(selectUserRole);
  const { data: unreadData } = useGetUnreadCountQuery(undefined, {
    pollingInterval: 60000,
  });

  const unreadCount = unreadData?.data?.unreadCount || 0;

  const NAV_GROUPS: NavGroup[] = [
    {
      title: t("nav.groups.overview"),
      items: [
        {
          label: t("nav.dashboard"),
          href: "/dashboard",
          icon: <LuLayoutDashboard className="w-4 h-4" />,
          roles: ["admin", "doctor", "receptionist"],
        },
      ],
    },
    {
      title: t("nav.groups.clinical"),
      items: [
        {
          label: t("nav.patients"),
          href: "/patients",
          icon: <LuUsers className="w-4 h-4" />,
          roles: ["admin", "doctor", "receptionist"],
        },
        {
          label: t("nav.doctors"),
          href: "/doctors",
          icon: <LuStethoscope className="w-4 h-4" />,
          roles: ["admin", "doctor", "receptionist"],
        },
        {
          label: t("nav.appointments"),
          href: "/appointments",
          icon: <LuCalendar className="w-4 h-4" />,
          roles: ["admin", "doctor", "receptionist"],
        },
        {
          label: t("nav.visits"),
          href: "/visits",
          icon: <LuClipboardCheck className="w-4 h-4" />,
          roles: ["admin", "doctor", "receptionist"],
        },
        {
          label: t("nav.prescriptions"),
          href: "/prescriptions",
          icon: <LuFileText className="w-4 h-4" />,
          roles: ["admin", "doctor", "receptionist"],
        },
        {
          label: t("nav.labOrders"),
          href: "/lab-orders",
          icon: <LuFlaskConical className="w-4 h-4" />,
          roles: ["admin", "doctor", "receptionist"],
        },
      ],
    },
    {
      title: t("nav.groups.operations"),
      items: [
        {
          label: t("nav.invoices"),
          href: "/invoices",
          icon: <LuReceipt className="w-4 h-4" />,
          roles: ["admin", "doctor", "receptionist"],
        },
        {
          label: t("nav.payments"),
          href: "/payments",
          icon: <LuCreditCard className="w-4 h-4" />,
          roles: ["admin", "doctor", "receptionist"],
        },
        {
          label: t("nav.medicalServices"),
          href: "/medical-services",
          icon: <LuActivity className="w-4 h-4" />,
          roles: ["admin", "doctor", "receptionist"],
        },
      ],
    },
    {
      title: t("nav.groups.insights"),
      items: [
        {
          label: t("nav.reports"),
          href: "/reports",
          icon: <LuChartBar className="w-4 h-4" />,
          roles: ["admin"],
        },
      ],
    },
    {
      title: t("nav.groups.administration"),
      items: [
        {
          label: t("nav.staffUsers"),
          href: "/users",
          icon: <LuShieldCheck className="w-4 h-4" />,
          roles: ["admin"],
        },
        {
          label: t("nav.auditLogs"),
          href: "/audit-logs",
          icon: <LuScrollText className="w-4 h-4" />,
          roles: ["admin"],
        },
      ],
    },
    {
      title: t("nav.groups.system"),
      items: [
        {
          label: t("nav.notifications"),
          href: "/notifications",
          icon: <LuBell className="w-4 h-4" />,
          badge: unreadCount,
          roles: ["admin", "doctor", "receptionist"],
        },
        {
          label: t("nav.settings"),
          href: "/settings",
          icon: <LuSettings className="w-4 h-4" />,
          roles: ["admin", "doctor", "receptionist"],
        },
      ],
    },
  ];

  return (
    <aside
      className={`h-full flex flex-col bg-surface border-e border-border-subtle transition-all duration-200 select-none ${
        isCollapsed ? "w-18" : "w-64"
      }`}
    >
      {/* Brand header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-border-subtle shrink-0">
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-2 overflow-hidden"
        >
          <Logo showText={!isCollapsed} size={isCollapsed ? "sm" : "md"} />
        </Link>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex text-slate-light hover:text-ink p-1.5 rounded-md hover:bg-paper transition-colors"
          aria-label={isCollapsed ? t("common.expandSidebar") : t("common.collapseSidebar")}
        >
          {isCollapsed ? (
            <LuPanelLeft className="w-4 h-4" />
          ) : (
            <LuPanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5 flex flex-col gap-4">
        {NAV_GROUPS.map((group) => {
          // Filter items by current user role
          const visibleItems = group.items.filter(
            (item) => !item.roles || (role && item.roles.includes(role))
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="flex flex-col gap-0.5">
              {!isCollapsed && (
                <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-light">
                  {group.title}
                </span>
              )}

              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={isCollapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 px-2.5 py-2 rounded-md text-xs transition-colors duration-150 ${
                      isActive
                        ? "bg-mint text-teal-dark font-semibold"
                        : "text-slate-muted hover:text-ink hover:bg-paper font-medium"
                    } ${isCollapsed ? "justify-center px-0" : ""}`}
                  >
                    {/* Active vertical indicator bar */}
                    {isActive && (
                      <span className="absolute start-0 top-1.5 bottom-1.5 w-1 rounded-e-full bg-teal-primary" />
                    )}

                    <span
                      className={`shrink-0 ${
                        isActive ? "text-teal-primary" : "text-slate-light group-hover:text-slate-dark"
                      }`}
                    >
                      {item.icon}
                    </span>

                    {!isCollapsed && (
                      <span className="truncate flex-1">{item.label}</span>
                    )}

                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isActive
                            ? "bg-teal-primary text-white dark:text-slate-950"
                            : "bg-status-error text-white"
                        } ${isCollapsed ? "absolute top-1 end-2" : ""}`}
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* System Status footer */}
      {!isCollapsed && (
        <div className="p-3 border-t border-border-subtle/80 bg-paper/40 flex items-center justify-between text-[11px] text-slate-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-status-success shrink-0 animate-pulse" />
            <span className="font-medium">System Online</span>
          </div>
          <span className="text-[10px] text-slate-light font-mono">v1.0</span>
        </div>
      )}
    </aside>
  );
}
