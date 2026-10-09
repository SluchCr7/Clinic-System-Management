"use client";

import React, { forwardRef, useState } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      type = "text",
      id,
      className = "",
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const isPassword = type === "password";
    const actualType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
      <div className="flex flex-col gap-1 w-full text-start">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-ink flex items-center gap-1 select-none"
          >
            {label}
            {required && <span className="text-status-error">*</span>}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute start-3 text-slate-light pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={actualType}
            disabled={disabled}
            required={required}
            className={`w-full h-9.5 px-3 rounded-md bg-surface border text-ink text-xs placeholder:text-slate-light transition-all duration-150 focus:outline-none disabled:bg-paper disabled:text-slate-light disabled:cursor-not-allowed ${
              leftIcon ? "ps-9" : ""
            } ${isPassword || rightIcon ? "pe-9" : ""} ${
              error
                ? "border-status-error focus:border-status-error focus:ring-2 focus:ring-status-error/20"
                : "border-border-subtle hover:border-border-medium focus:border-teal-primary focus:ring-2 focus:ring-teal-primary/20"
            } ${className}`}
            {...props}
          />

          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={-1}
              className="absolute end-3 text-slate-light hover:text-ink focus:outline-none transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <LuEyeOff className="w-4 h-4" />
              ) : (
                <LuEye className="w-4 h-4" />
              )}
            </button>
          ) : (
            rightIcon && (
              <div className="absolute end-3 text-slate-light pointer-events-none flex items-center justify-center">
                {rightIcon}
              </div>
            )
          )}
        </div>

        {error ? (
          <p className="text-[11px] text-status-error font-medium leading-none mt-0.5">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-muted leading-none mt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
