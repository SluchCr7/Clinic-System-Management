"use client";

import React from "react";
import { useTranslation } from "react-i18next";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "neutral" | "teal" | "success" | "warning" | "error" | "info";
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  className = "",
}: BadgeProps) {
  const variantStyles = {
    default: "bg-paper text-ink border border-border-subtle",
    neutral: "bg-paper text-slate-muted border border-border-subtle",
    teal: "bg-mint text-teal-dark border border-teal-primary/20",
    success: "bg-status-success-bg text-status-success border border-status-success/20",
    warning: "bg-status-warning-bg text-status-warning border border-status-warning/20",
    error: "bg-status-error-bg text-status-error border border-status-error/20",
    info: "bg-status-info-bg text-status-info border border-status-info/20",
  };

  const dotColors = {
    default: "bg-slate-muted",
    neutral: "bg-slate-light",
    teal: "bg-teal-primary",
    success: "bg-status-success",
    warning: "bg-status-warning",
    error: "bg-status-error",
    info: "bg-status-info",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full select-none capitalize ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}

export interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ status, size = "md", className = "" }: StatusBadgeProps) {
  const { t } = useTranslation();
  const normalized = status?.toLowerCase().replace(/[_\s]/g, "-") || "";

  let variant: BadgeProps["variant"] = "neutral";

  switch (normalized) {
    // Active / Success states
    case "active":
    case "confirmed":
    case "completed":
    case "paid":
      variant = "success";
      break;

    // Upcoming / In-progress / Teal states
    case "scheduled":
    case "checked-in":
    case "in-progress":
    case "sample-collected":
    case "processing":
      variant = "teal";
      break;

    // Warning / Partial states
    case "partially-paid":
    case "urgent":
      variant = "warning";
      break;

    // Inactive / Cancelled / Error states
    case "inactive":
    case "cancelled":
    case "no-show":
    case "unpaid":
    case "stat":
      variant = "error";
      break;

    // Neutral / Informational states
    case "ordered":
    case "routine":
    default:
      variant = "info";
      break;
  }

  // Format label nicely
  const label = t(`common.statuses.${normalized}`, {
    defaultValue: status?.replace(/_/g, " ") || "",
  });

  return (
    <Badge variant={variant} size={size} dot className={className}>
      {label}
    </Badge>
  );
}

export default Badge;
