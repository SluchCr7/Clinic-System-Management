import React from "react";
import { LuFolderOpen, LuCircleAlert, LuRefreshCw } from "react-icons/lu";
import Button from "./Button";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-surface rounded-lg border border-border-subtle border-dashed ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-paper border border-border-subtle flex items-center justify-center text-slate-muted mb-3.5">
        {icon || <LuFolderOpen className="w-6 h-6 stroke-[1.5]" />}
      </div>
      <h3 className="text-sm font-semibold text-ink leading-tight">{title}</h3>
      <p className="text-xs text-slate-muted max-w-sm mt-1.5 mb-5 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load the requested medical information. Please try again.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-status-error-bg/30 rounded-lg border border-status-error/20 ${className}`}
    >
      <div className="w-11 h-11 rounded-full bg-status-error-bg flex items-center justify-center text-status-error mb-3.5 border border-status-error/30">
        <LuCircleAlert className="w-5 h-5 stroke-[2]" />
      </div>
      <h3 className="text-sm font-semibold text-ink leading-tight">{title}</h3>
      <p className="text-xs text-slate-muted max-w-sm mt-1.5 mb-5 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<LuRefreshCw className="w-3.5 h-3.5" />}
        >
          Try Again
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
