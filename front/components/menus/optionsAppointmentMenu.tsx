import React from 'react'
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
    handleStatusTransition: (id: string, status: AppointmentStatus) => void | Promise<void>;
    setActiveMenuId: (id: string | null) => void;
    router: {
        push: (url: string) => void;
    };
    setCancelTargetId: (id: string) => void;
    t: (key: string) => string;
}

const OptionsAppointmentMenu = ({ apt, role, isRtl, isUpdating, handleStatusTransition, setActiveMenuId, router, setCancelTargetId , t } : OptionsAppointmentMenuProps) => {
  return (
    <div 
        className={`absolute top-full mt-1 w-48 bg-surface border border-border-subtle rounded-lg shadow-lg py-1.5 z-50 flex flex-col ${
        isRtl ? "left-0" : "right-0"
        }`}
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
            onClick={() => {
            setActiveMenuId(null);
            router.push(`/visits/new?appointmentId=${apt._id}`);
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-teal-dark hover:bg-mint/50 text-start transition-colors"
        >
            <LuStethoscope className="w-4 h-4 text-teal-primary shrink-0" />
            <span>{t("appointments.actions.startVisit")}</span>
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
    </div>
  )
}

export default OptionsAppointmentMenu