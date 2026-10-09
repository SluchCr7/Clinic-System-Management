import React, { forwardRef } from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      id,
      className = "",
      required,
      disabled,
      rows = 3,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex flex-col gap-1 w-full text-start">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-xs font-medium text-ink flex items-center gap-1 select-none"
          >
            {label}
            {required && <span className="text-status-error">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          required={required}
          className={`w-full p-3 rounded-md bg-surface border text-ink text-xs placeholder:text-slate-light transition-all duration-150 focus:outline-none disabled:bg-paper disabled:text-slate-light disabled:cursor-not-allowed ${
            error
              ? "border-status-error focus:border-status-error focus:ring-2 focus:ring-status-error/20"
              : "border-border-subtle hover:border-border-medium focus:border-teal-primary focus:ring-2 focus:ring-teal-primary/20"
          } ${className}`}
          {...props}
        />

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

Textarea.displayName = "Textarea";
export default Textarea;
