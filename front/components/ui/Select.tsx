import React, { forwardRef } from "react";
import { LuChevronDown } from "react-icons/lu";

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options = [],
      placeholder,
      id,
      className = "",
      required,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex flex-col gap-1 w-full text-start">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-medium text-ink flex items-center gap-1 select-none"
          >
            {label}
            {required && <span className="text-status-error">*</span>}
          </label>
        )}

        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            className={`w-full h-9.5 ps-3 pe-8 rounded-md bg-surface border text-ink text-xs appearance-none transition-all duration-150 focus:outline-none disabled:bg-paper disabled:text-slate-light disabled:cursor-not-allowed ${
              error
                ? "border-status-error focus:border-status-error focus:ring-2 focus:ring-status-error/20"
                : "border-border-subtle hover:border-border-medium focus:border-teal-primary focus:ring-2 focus:ring-teal-primary/20"
            } ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled className="bg-surface text-ink">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-surface text-ink">
                {opt.label}
              </option>
            ))}
            {children}
          </select>

          <div className="absolute end-2.5 text-slate-light pointer-events-none flex items-center justify-center">
            <LuChevronDown className="w-4 h-4" />
          </div>
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

Select.displayName = "Select";
export default Select;
