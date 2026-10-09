"use client";

import { useEffect, useState } from "react";
import { LuCircleCheck, LuTriangleAlert, LuCircleX, LuInfo, LuX } from "react-icons/lu";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

type Listener = (toasts: ToastMessage[]) => void;
let toasts: ToastMessage[] = [];
const listeners: Set<Listener> = new Set();

const notify = () => {
  listeners.forEach((l) => l([...toasts]));
};

export const toast = {
  show: (type: ToastType, message: string, title?: string, duration = 4000) => {
    const id = Math.random().toString(36).slice(2, 9);
    toasts = [...toasts, { id, type, title, message, duration }];
    notify();

    setTimeout(() => {
      toast.dismiss(id);
    }, duration);
  },
  success: (message: string, title = "Success") => toast.show("success", message, title),
  error: (message: string, title = "Error") => toast.show("error", message, title, 5000),
  warning: (message: string, title = "Warning") => toast.show("warning", message, title),
  info: (message: string, title = "Information") => toast.show("info", message, title),
  dismiss: (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },
};

export default function ToastContainer() {
  const [activeToasts, setActiveToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const update = (newToasts: ToastMessage[]) => setActiveToasts(newToasts);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {activeToasts.map((item) => {
        const isSuccess = item.type === "success";
        const isError = item.type === "error";
        const isWarning = item.type === "warning";

        const icon = isSuccess ? (
          <LuCircleCheck className="w-5 h-5 text-status-success shrink-0" />
        ) : isError ? (
          <LuCircleX className="w-5 h-5 text-status-error shrink-0" />
        ) : isWarning ? (
          <LuTriangleAlert className="w-5 h-5 text-status-warning shrink-0" />
        ) : (
          <LuInfo className="w-5 h-5 text-status-info shrink-0" />
        );

        return (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex items-start gap-3 p-3.5 bg-surface rounded-lg border border-border-subtle shadow-elevated transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            {icon}
            <div className="flex-1 min-w-0 pt-0.5">
              {item.title && (
                <p className="text-xs font-semibold text-ink leading-tight mb-0.5">
                  {item.title}
                </p>
              )}
              <p className="text-xs text-slate-muted leading-relaxed">
                {item.message}
              </p>
            </div>
            <button
              onClick={() => toast.dismiss(item.id)}
              className="text-slate-light hover:text-ink p-1 rounded-sm transition-colors"
              aria-label="Dismiss notification"
            >
              <LuX className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
