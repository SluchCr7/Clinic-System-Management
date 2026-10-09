import React, { forwardRef } from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      className = "",
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none";

    const variantStyles = {
      primary:
        "bg-teal-primary text-white dark:text-slate-950 dark:font-semibold hover:bg-teal-dark active:bg-teal-dark shadow-subtle",
      secondary:
        "bg-surface text-ink border border-border-subtle hover:bg-paper hover:border-border-medium active:bg-paper shadow-subtle",
      ghost:
        "bg-transparent text-slate-muted hover:text-ink hover:bg-paper active:bg-mint/20",
      danger:
        "bg-status-error text-white hover:bg-red-700 active:bg-red-800 shadow-subtle",
      outline:
        "bg-transparent border border-teal-primary text-teal-primary hover:bg-mint/20 active:bg-mint/40",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs rounded-sm gap-1.5",
      md: "h-9.5 px-4 text-xs rounded-md gap-2",
      lg: "h-11 px-5 text-sm rounded-md gap-2.5",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-3.5 w-3.5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
