import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuCheck, LuCircleX, LuStethoscope, LuUserCheck, LuUserX } from 'react-icons/lu';
import { AppointmentStatus } from '@/types';
interface Appointment {
    _id: string;
    status : AppointmentStatus;
}

interface OptionsAppointmentMenuProps {
    apt: Appointment;
    role: string | undefined;
    isRtl: boolean;
    isUpdating: boolean;
    handleStatusTransition: (id: string, status: AppointmentStatus) => void | Promise<boolean>;
    handleStartVisit: (id: string) => void | Promise<void>;
    setActiveMenuId: (id: string | null) => void;
    setCancelTargetId: (id: string) => void;
    anchorRef: React.RefObject<HTMLButtonElement | null>;
    t: (key: string) => string;
}

const OptionsAppointmentMenu = ({
  apt,
  role,
  isRtl,
  isUpdating,
  handleStatusTransition,
  handleStartVisit,
  setActiveMenuId,
  setCancelTargetId,
  anchorRef,
  t,
}: OptionsAppointmentMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const portalRoot =
    typeof document === "undefined" ? null : document.body;

  useEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) return;

      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const gap = 4;
      const viewportPadding = 8;
      const belowSpace = window.innerHeight - anchorRect.bottom - gap;
      const aboveSpace = anchorRect.top - gap;
      const openAbove = menuRect.height > belowSpace && aboveSpace > belowSpace;
      const maxTop = Math.max(
        viewportPadding,
        window.innerHeight - menuRect.height - viewportPadding
      );
      const top = openAbove
        ? Math.max(viewportPadding, anchorRect.top - menuRect.height - gap)
        : Math.min(anchorRect.bottom + gap, maxTop);
      const preferredLeft = isRtl
        ? anchorRect.left
        : anchorRect.right - menuRect.width;
      const maxLeft = Math.max(
        viewportPadding,
        window.innerWidth - menuRect.width - viewportPadding
      );
      const left = Math.min(Math.max(preferredLeft, viewportPadding), maxLeft);

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, isRtl, portalRoot]);

  if (!portalRoot) return null;

  return createPortal(
    <div
      ref={menuRef}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "fixed",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
        maxHeight: "calc(100vh - 16px)",
        maxWidth: "calc(100vw - 16px)",
        overflowY: "auto",
      }}
      className="w-48 bg-surface border border-border-subtle rounded-lg shadow-lg py-1.5 z-[1000] flex flex-col"
    >
        {/* Scheduled -> Confirm */}
        {apt.status === "scheduled" && (role === "admin" || role === "receptionist") && (
        <button
            type="button"
            onClick={() => handleStatusTransition(apt._id, "confirmed")}
            disabled={isUpdating}
            className="flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-mint/40 text-start transition-colors"
        >
            <LuCheck className="w-4 h-4 text-teal-primary shrink-0" />
            <span>{t("appointments.actions.confirm")}</span>
        </button>
        )}

        {/* Confirmed / Scheduled -> Check In */}
        {(apt.status === "scheduled" || apt.status === "confirmed") && (role === "admin" || role === "receptionist") && (
        <button
            type="button"
            onClick={() => handleStatusTransition(apt._id, "checked_in")}
            disabled={isUpdating}
            className="flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-status-info-bg/40 text-start transition-colors"
        >
            <LuUserCheck className="w-4 h-4 text-status-info shrink-0" />
            <span>{t("appointments.actions.checkIn")}</span>
        </button>
        )}

        {/* Checked In / In Progress -> Start Visit */}
        {(apt.status === "checked_in" || apt.status === "confirmed" || apt.status === "in_progress") && (role === "admin" || role === "doctor") && (
        <button
            type="button"
            onClick={() => handleStartVisit(apt._id)}
            disabled={isUpdating}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-teal-dark hover:bg-mint/50 text-start transition-colors"
        >
            <LuStethoscope className="w-4 h-4 text-teal-primary shrink-0" />
            <span>{t("appointments.actions.startVisit")}</span>
        </button>
        )}

        {apt.status === "in_progress" && (role === "admin" || role === "doctor") && (
        <button
            type="button"
            onClick={() => handleStatusTransition(apt._id, "completed")}
            disabled={isUpdating}
            className="flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-mint/40 text-start transition-colors"
        >
            <LuCheck className="w-4 h-4 text-teal-primary shrink-0" />
            <span>{t("appointments.actions.completeVisit")}</span>
        </button>
        )}

        {/* Mark No Show */}
        {(apt.status === "scheduled" || apt.status === "confirmed") && (role === "admin" || role === "receptionist") && (
        <button
            type="button"
            onClick={() => handleStatusTransition(apt._id, "no-show")}
            disabled={isUpdating}
            className="flex items-center gap-2 px-3 py-2 text-xs text-ink hover:bg-status-warning-bg/40 text-start transition-colors"
        >
            <LuUserX className="w-4 h-4 text-status-warning shrink-0" />
            <span>{t("appointments.actions.markNoShow")}</span>
        </button>
        )}

        <div className="my-1 border-t border-border-subtle" />

        {/* Cancel appointment */}
        <button
        type="button"
        onClick={() => {
            setActiveMenuId(null);
            setCancelTargetId(apt._id);
        }}
        className="flex items-center gap-2 px-3 py-2 text-xs text-status-error hover:bg-status-error-bg/40 text-start transition-colors"
        >
        <LuCircleX className="w-4 h-4 shrink-0" />
        <span>{t("appointments.cancelAppointment")}</span>
        </button>
    </div>,
    portalRoot
  )
}

export default OptionsAppointmentMenu