import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export function Card({
  children,
  className = "",
  hoverable = false,
  ...props
}: CardProps) {
  return (
    <div
      className={`bg-surface border border-border-subtle rounded-lg shadow-subtle ${
        hoverable ? "hover:border-border-medium hover:shadow-card transition-all duration-150" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  subtitle,
  action,
  children,
  className = "",
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={`p-4 sm:p-5 border-b border-border-subtle flex items-center justify-between gap-4 ${className}`}
      {...props}
    >
      {children ? (
        children
      ) : (
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="text-sm font-semibold text-ink leading-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-slate-muted mt-1 leading-normal">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({
  children,
  className = "",
  ...props
}: CardContentProps) {
  return (
    <div className={`p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({
  children,
  className = "",
  ...props
}: CardFooterProps) {
  return (
    <div
      className={`p-4 sm:p-5 border-t border-border-subtle bg-paper/50 rounded-b-lg flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
