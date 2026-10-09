"use client";

import React, { useEffect, useState } from "react";
import { LuSearch, LuX } from "react-icons/lu";

export interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onDebouncedChange?: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value: initialValue = "",
  onChange,
  onDebouncedChange,
  debounceMs = 300,
  placeholder = "Search...",
  className = "",
}: SearchInputProps) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [prevInitialValue, setPrevInitialValue] = useState(initialValue);

  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue);
    setSearchTerm(initialValue);
  }

  useEffect(() => {
    if (!onDebouncedChange) return;
    const timer = setTimeout(() => {
      onDebouncedChange(searchTerm);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs, onDebouncedChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (onChange) onChange(val);
  };

  const handleClear = () => {
    setSearchTerm("");
    if (onChange) onChange("");
    if (onDebouncedChange) onDebouncedChange("");
  };

  return (
    <div className={`relative flex items-center w-full max-w-xs ${className}`}>
      <div className="absolute start-3 text-slate-light pointer-events-none flex items-center justify-center">
        <LuSearch className="w-3.5 h-3.5" />
      </div>

      <input
        type="text"
        value={searchTerm}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full h-9 ps-8.5 pe-8 rounded-md bg-surface border border-border-subtle text-ink text-xs placeholder:text-slate-light transition-all duration-150 focus:outline-none hover:border-border-medium focus:border-teal-primary focus:ring-2 focus:ring-teal-primary/20 shadow-subtle"
      />

      {searchTerm && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute end-2.5 text-slate-light hover:text-ink p-1 rounded-sm transition-colors"
          aria-label="Clear search"
        >
          <LuX className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default SearchInput;
