"use client";

import React, { useEffect } from "react";
import { LuX } from "react-icons/lu";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  position?: "left" | "right";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  position = "right",
  size = "md",
  className = "",
}: DrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-xs",
    md: "max-w-md",
    lg: "max-w-lg",
  };

  const isLeft = position === "left";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-overlay backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-y-0 ${
          isLeft ? "left-0" : "right-0"
        } flex max-w-full`}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={`w-screen ${sizeClasses[size]} bg-surface shadow-dialog flex flex-col border-border-subtle ${
            isLeft ? "border-r animate-in slide-in-from-left duration-250" : "border-l animate-in slide-in-from-right duration-250"
          } ${className}`}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-light hover:text-ink p-1 rounded-sm transition-colors focus:outline-none"
              aria-label="Close drawer"
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 p-5 overflow-y-auto">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-5 py-3.5 border-t border-border-subtle bg-paper/60">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Drawer;
