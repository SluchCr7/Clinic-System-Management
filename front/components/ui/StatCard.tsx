import React from "react";
import Card from "./Card";

export interface StatItem {
  label: string;
  value: string | number;
  variant?: "teal" | "neutral" | "success" | "warning" | "error";
}

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  breakdown?: StatItem[];
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  variant?: "default" | "teal" | "success" | "warning";
  highlight?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  description,
  icon,
  breakdown,
  trend,
  variant = "default",
  highlight = false,
  className = "",
}: StatCardProps) {
  const isTeal = variant === "teal" || highlight;
  const isSuccess = variant === "success";
  const isWarning = variant === "warning";

  const getVariantStyles = () => {
    if (isTeal) return "border-teal-primary/30 bg-mint/10";
    if (isSuccess) return "border-status-success/30 bg-status-success-bg/20";
    if (isWarning) return "border-status-warning/30 bg-status-warning-bg/20";
    return "";
  };

  const getIconStyles = () => {
    if (isTeal) return "bg-teal-primary text-white dark:text-slate-950";
    if (isSuccess) return "bg-status-success text-white";
    if (isWarning) return "bg-status-warning text-white";
    return "bg-paper text-slate-muted border border-border-subtle";
  };

  return (
    <Card
      hoverable
      className={`p-4 sm:p-5 flex flex-col justify-between ${getVariantStyles()} ${className}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-muted">
            {title}
          </p>
          {icon && (
            <div className={`p-2 rounded-md ${getIconStyles()}`}>
              {icon}
            </div>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-sans">
            {value}
          </span>
          {trend && (
            <span
              className={`text-xs font-medium flex items-center gap-0.5 ${
                trend.isPositive ? "text-status-success" : "text-status-error"
              }`}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}
              {trend.label && (
                <span className="text-[10px] text-slate-light font-normal">
                  {trend.label}
                </span>
              )}
            </span>
          )}
        </div>

        {(subtitle || description) && (
          <p className="text-xs text-slate-muted mt-1 leading-normal">
            {subtitle || description}
          </p>
        )}
      </div>

      {breakdown && breakdown.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-border-subtle/80 flex items-center flex-wrap gap-x-3 gap-y-1.5 text-xs">
          {breakdown.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="font-semibold text-ink">{item.value}</span>
              <span className="text-[11px] text-slate-muted">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default StatCard;
