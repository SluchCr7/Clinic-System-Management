import React from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  backAction?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  backAction,
  className = "",
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle/80 ${className}`}
    >
      <div className="flex items-center gap-3">
        {backAction && <div className="shrink-0">{backAction}</div>}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink font-sans">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-muted mt-1 leading-normal">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
