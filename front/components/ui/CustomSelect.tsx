"use client";

import React, { useState, useRef, useEffect } from "react";
import { LuChevronDown, LuCheck } from "react-icons/lu";

export interface CustomSelectOption {
  value: string;
  label: string;
  badge?: string;
}

export interface CustomSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = "اختر...",
  error,
  disabled = false,
  required = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col gap-1 w-full text-start ${className}`}
    >
      {label && (
        <label className="text-xs font-semibold text-ink flex items-center gap-1 select-none">
          {label}
          {required && <span className="text-status-error">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full h-9.5 px-3 rounded-md bg-surface border text-xs flex items-center justify-between gap-2 transition-all duration-150 focus:outline-none ${
          disabled
            ? "bg-paper/50 text-slate-muted cursor-not-allowed opacity-60"
            : error
            ? "border-status-error text-ink focus:ring-2 focus:ring-status-error/20"
            : isOpen
            ? "border-teal-primary ring-2 ring-teal-primary/20 text-ink"
            : "border-border-subtle hover:border-border-medium text-ink"
        }`}
      >
        <span className={`truncate ${!selectedOption ? "text-slate-muted" : "font-semibold text-ink"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <LuChevronDown
          className={`w-4 h-4 text-slate-muted shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-teal-primary" : ""
          }`}
        />
      </button>

      {/* High-Contrast Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] start-0 end-0 z-50 max-h-60 overflow-y-auto rounded-md bg-[#1e293b] border border-slate-700 shadow-2xl py-1 text-xs">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-slate-400 text-center">لا توجد خيارات</div>
          ) : (
            options.map((option) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-teal-600/30 text-teal-200 font-bold border-r-2 border-teal-400"
                      : "text-slate-100 hover:bg-slate-700/60 hover:text-white"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <LuCheck className="w-4 h-4 text-teal-400 shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      )}

      {error && <p className="text-[11px] text-status-error">{error}</p>}
    </div>
  );
};

export default CustomSelect;
