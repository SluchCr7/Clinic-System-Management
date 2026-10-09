"use client";

import React from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = "" }: TabsProps) {
  return (
    <div
      className={`inline-flex items-center p-1 bg-paper border border-border-subtle rounded-lg gap-1 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-primary/30 select-none ${
              isActive
                ? "bg-surface text-ink font-semibold shadow-subtle border border-border-subtle/60"
                : "text-slate-muted hover:text-ink hover:bg-surface/50 font-medium"
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                  isActive
                    ? "bg-mint text-teal-dark font-semibold"
                    : "bg-paper text-slate-muted"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
