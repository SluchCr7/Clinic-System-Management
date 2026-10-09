"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme, type Theme } from "@/components/providers/ThemeProvider";
import { LuSun, LuMoon, LuMonitor, LuCheck } from "react-icons/lu";

export interface ThemeSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeSwitcher({ className = "", showLabel = false }: ThemeSwitcherProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const options: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
    {
      value: "light",
      label: t("theme.light", "Light"),
      icon: <LuSun className="w-4 h-4 text-amber-500" />,
    },
    {
      value: "dark",
      label: t("theme.dark", "Dark"),
      icon: <LuMoon className="w-4 h-4 text-teal-primary" />,
    },
    {
      value: "system",
      label: t("theme.system", "System"),
      icon: <LuMonitor className="w-4 h-4 text-slate-muted" />,
    },
  ];

  const currentIcon =
    theme === "system" ? (
      <LuMonitor className="w-4 h-4 text-slate-muted group-hover:text-ink transition-colors" />
    ) : resolvedTheme === "dark" ? (
      <LuMoon className="w-4 h-4 text-teal-primary transition-colors" />
    ) : (
      <LuSun className="w-4 h-4 text-amber-500 transition-colors" />
    );

  return (
    <div className={`relative ${className}`} ref={menuRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t("theme.toggle", "Change visual theme")}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={t("theme.toggle", "Change visual theme")}
        className="group flex items-center gap-2 p-2 rounded-lg text-slate-muted hover:text-ink hover:bg-paper transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-primary/30"
      >
        {currentIcon}
        {showLabel && (
          <span className="text-xs font-medium text-ink capitalize">
            {t(`theme.${theme}`, theme)}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute end-0 mt-2 w-44 bg-surface rounded-xl border border-border-subtle shadow-dialog py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          <div className="px-3 py-1.5 border-b border-border-subtle text-[10px] font-semibold uppercase tracking-wider text-slate-muted">
            {t("theme.appearance", "Appearance")}
          </div>

          <div className="py-1">
            {options.map((option) => {
              const isSelected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setTheme(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left ${
                    isSelected
                      ? "bg-mint text-teal-dark font-semibold"
                      : "text-ink hover:bg-paper font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {option.icon}
                    <span>{option.label}</span>
                  </div>
                  {isSelected && (
                    <LuCheck className="w-3.5 h-3.5 text-teal-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
