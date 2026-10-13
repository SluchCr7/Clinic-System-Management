"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetAppointmentsQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
  useCancelAppointmentMutation,
} from "@/services/api/appointmentApi";
import { useGetPatientsQuery } from "@/services/api/patientApi";
import { useGetDoctorsQuery } from "@/services/api/doctorApi";
import type {
  Appointment,
  AppointmentQueryParams,
  AppointmentStatus,
} from "@/types/appointment";
import {
  PageHeader,
  DataTable,
  Button,
  Select,
  Input,
  Textarea,
  Modal,
  ConfirmDialog,
  StatusBadge,
  toast,
  type Column,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import { selectUserRole } from "@/features/auth/authSelectors";
import { useAppSelector } from "@/redux/hooks";
import { useRouter } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import {
  LuPlus,
  LuCalendar,
  LuList,
  LuClock,
  LuCircleX,
  LuCheck,
  LuUserCheck,
  LuStethoscope,
  LuUserX,
} from "react-icons/lu";

export default function AppointmentsPage() {
  const { t } = useTranslation();
  const role = useAppSelector(selectUserRole);
  const canCreateAppointment = hasPermission(role, "appointments.create");
  const canEditAppointment = hasPermission(role, "appointments.edit");
  const [viewMode, setViewMode] = useState<"list" | "agenda">("list");
  const [queryParams, setQueryParams] = useState<AppointmentQueryParams>({
    page: 1,
    limit: 10,
    status: undefined,
    date: undefined,
    sortBy: "appointmentDate",
    sortOrder: "desc",
  });

  const { data, isLoading, isError, refetch } =
    useGetAppointmentsQuery(queryParams);

  // For booking modal selections
  const { data: patientsData } = useGetPatientsQuery({ limit: 50, isActive: true });
  const { data: doctorsData } = useGetDoctorsQuery({ limit: 50, isActive: true });

  const [createAppointment, { isLoading: isCreating }] =
    useCreateAppointmentMutation();
  const [updateAppointment, { isLoading: isUpdating }] =
    useUpdateAppointmentMutation();
  const [cancelAppointment, { isLoading: isCancelling }] =
    useCancelAppointmentMutation();

  const router = useRouter();

  const handleStatusTransition = async (id: string, newStatus: AppointmentStatus) => {
    try {
      await updateAppointment({
        id,
        data: { status: newStatus },
      }).unwrap();
      toast.success(t("appointments.success.statusUpdated"));
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("appointments.errors.updateStatusFailed"));
    }
  };

  // Booking Modal State
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    patient: "",
    doctor: "",
    appointmentDate: "",
    duration: 30,
    reason: "",
    notes: "",
  });
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Cancellation Dialog State
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const formatClinicDateTimeForInput = (date: Date) => {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });

    return formatter.format(date).replace(" ", "T");
  };

  const handleOpenBookModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    setBookingForm({
      patient: patientsData?.data?.[0]?._id || "",
      doctor: doctorsData?.data?.[0]?._id || "",
      appointmentDate: formatClinicDateTimeForInput(tomorrow),
      duration: 30,
      reason: "",
      notes: "",
    });
    setBookingError(null);
    setIsBookModalOpen(true);
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!bookingForm.patient || !bookingForm.doctor || !bookingForm.appointmentDate) {
      setBookingError(t("appointments.errors.missingBookingInfo"));
      return;
    }

    try {
      const payload = {
        patient: bookingForm.patient,
        doctor: bookingForm.doctor,
        appointmentDate: bookingForm.appointmentDate,
        duration: Number(bookingForm.duration) || 30,
        reason: bookingForm.reason.trim() || undefined,
        notes: bookingForm.notes.trim() || undefined,
      };

      const res = await createAppointment(payload).unwrap();
      if (res.success) {
        toast.success(t("appointments.success.booked"));
        setIsBookModalOpen(false);
      }
    } catch (err) {
      const extracted = extractApiError(err);
      setBookingError(extracted.message || t("appointments.errors.bookingFailed"));
      toast.error(extracted.message || t("appointments.errors.bookingFailed"));
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTargetId) return;
    try {
      await cancelAppointment(cancelTargetId).unwrap();
      toast.success(t("appointments.success.cancelled"));
      setCancelTargetId(null);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("appointments.errors.cancelFailed"));
    }
  };

  const columns: Column<Appointment>[] = [
    {
      key: "appointmentDate",
      header: t("appointments.dateTime"),
      className: "w-[120px] min-w-[120px] overflow-hidden whitespace-nowrap",
      render: (apt) => {
        const d = new Date(apt.appointmentDate);
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-ink text-xs">
              {d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="text-[11px] text-slate-muted font-mono flex items-center gap-1">
              <LuClock className="w-3 h-3 text-slate-light" />
              {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        );
      },
    },
    {
      key: "patient",
      header: t("appointments.patient"),
      className: "w-[190px] min-w-[190px] overflow-hidden whitespace-nowrap",
      render: (apt) => {
        const p = typeof apt.patient === "object" && apt.patient ? apt.patient : null;
        return (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-mint text-teal-dark font-semibold text-xs flex items-center justify-center shrink-0">
              {p ? p.firstName[0] : "P"}
            </div>
            <div className="min-w-0 overflow-hidden">
              <p className="truncate font-semibold text-ink leading-tight">
                {p ? `${p.firstName} ${p.lastName}` : t("appointments.patient")}
              </p>
              <p className="truncate text-[11px] text-slate-muted font-mono">{p?.phone || ""}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "doctor",
      header: t("appointments.physician"),
      className: "w-[145px] min-w-[145px] overflow-hidden whitespace-nowrap",
      render: (apt) => {
        const doc = typeof apt.doctor === "object" && apt.doctor ? apt.doctor : null;
        const u = doc && typeof doc.user === "object" && doc.user ? doc.user : null;
        return (
          <div className="min-w-0 overflow-hidden">
            <p className="truncate font-medium text-ink leading-tight">
              {u ? `Dr. ${u.lastName}` : t("common.doctor")}
            </p>
            <p className="truncate text-[11px] text-teal-primary font-medium">
              {doc?.specialization || t("appointments.general")}
            </p>
          </div>
        );
      },
    },
    {
      key: "reason",
      header: t("appointments.reasonNotes"),
      className: "w-[180px] min-w-[180px] overflow-hidden whitespace-nowrap",
      render: (apt) => (
        <span className="block max-w-full truncate text-slate-muted">
          {apt.reason || apt.notes || t("appointments.routineConsultation")}
        </span>
      ),
    },
    {
      key: "duration",
      header: t("appointments.duration"),
      className: "w-[72px] min-w-[72px] overflow-hidden whitespace-nowrap",
      render: (apt) => t("appointments.durationMinutes", { count: apt.duration }),
    },
    {
      key: "status",
      header: t("appointments.status"),
      className: "w-[105px] min-w-[105px] overflow-hidden whitespace-nowrap",
      render: (apt) => <StatusBadge status={apt.status} size="sm" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-[260px] min-w-[260px] overflow-hidden whitespace-nowrap",
      render: (apt) => {
        if (!canEditAppointment || apt.status === "cancelled" || apt.status === "completed") {
          return null;
        }

        return (
          <div className="flex max-w-full min-w-0 items-center justify-end gap-1 overflow-hidden whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            {/* Scheduled -> Confirm */}
            {apt.status === "scheduled" && (role === "admin" || role === "receptionist") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusTransition(apt._id, "confirmed")}
                disabled={isUpdating}
                className="max-w-[88px] min-w-0 gap-1 overflow-hidden px-2 text-teal-primary hover:text-teal-dark hover:bg-mint/40"
                title={t("appointments.actions.confirm")}
              >
                <LuCheck className="w-4 h-4 shrink-0" />
                <span className="block min-w-0 truncate text-xs">{t("appointments.actions.confirm")}</span>
              </Button>
            )}

            {/* Confirmed / Scheduled -> Check In */}
            {(apt.status === "scheduled" || apt.status === "confirmed") && (role === "admin" || role === "receptionist") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusTransition(apt._id, "checked_in")}
                disabled={isUpdating}
                className="max-w-[88px] min-w-0 gap-1 overflow-hidden px-2 text-status-info hover:bg-status-info-bg/40"
                title={t("appointments.actions.checkIn")}
              >
                <LuUserCheck className="w-4 h-4 shrink-0" />
                <span className="block min-w-0 truncate text-xs">{t("appointments.actions.checkIn")}</span>
              </Button>
            )}

            {/* Checked In / In Progress -> Start Visit / Consultation (Doctor or Admin) */}
            {(apt.status === "checked_in" || apt.status === "confirmed" || apt.status === "in_progress") && (role === "admin" || role === "doctor") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/visits/new?appointmentId=${apt._id}`)}
                className="max-w-[88px] min-w-0 gap-1 overflow-hidden px-2 text-teal-dark font-semibold bg-mint/50 hover:bg-mint"
                title={t("appointments.actions.startVisit")}
              >
                <LuStethoscope className="w-4 h-4 shrink-0" />
                <span className="block min-w-0 truncate text-xs">{t("appointments.actions.startVisit")}</span>
              </Button>
            )}

            {/* Mark No Show */}
            {(apt.status === "scheduled" || apt.status === "confirmed") && (role === "admin" || role === "receptionist") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusTransition(apt._id, "no-show")}
                disabled={isUpdating}
                className="text-slate-muted hover:text-status-warning"
                title={t("appointments.actions.markNoShow")}
              >
                <LuUserX className="w-4 h-4" />
              </Button>
            )}

            {/* Cancel appointment */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCancelTargetId(apt._id)}
              className="text-slate-muted hover:text-status-error"
              title={t("appointments.cancelAppointment")}
            >
              <LuCircleX className="w-4 h-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("appointments.title")}
        subtitle={t("appointments.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 bg-paper border border-border-subtle rounded-md">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-sm transition-colors ${
                  viewMode === "list"
                    ? "bg-surface text-ink shadow-subtle"
                    : "text-slate-muted hover:text-ink"
                }`}
                title={t("appointments.tableView")}
              >
                <LuList className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("agenda")}
                className={`p-1.5 rounded-sm transition-colors ${
                  viewMode === "agenda"
                    ? "bg-surface text-ink shadow-subtle"
                    : "text-slate-muted hover:text-ink"
                }`}
                title={t("appointments.agendaView")}
              >
                <LuCalendar className="w-4 h-4" />
              </button>
            </div>

            {canCreateAppointment && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<LuPlus className="w-3.5 h-3.5" />}
                onClick={handleOpenBookModal}
              >
                {t("appointments.book")}
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2.5">
          <Input
            type="date"
            value={queryParams.date || ""}
            onChange={(e) =>
              setQueryParams((prev) => ({
                ...prev,
                date: e.target.value || undefined,
                page: 1,
              }))
            }
            className="max-w-xs"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-36">
            <Select
              value={queryParams.status || ""}
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  status: (e.target.value as AppointmentStatus) || undefined,
                  page: 1,
                }))
              }
              placeholder={t("appointments.allStatuses")}
              options={[
                { value: "", label: t("appointments.allStatuses") },
                { value: "scheduled", label: t("appointments.statusOptions.scheduled") },
                { value: "confirmed", label: t("appointments.statusOptions.confirmed") },
                { value: "checked_in", label: t("appointments.statusOptions.checkedIn") },
                { value: "in_progress", label: t("appointments.statusOptions.inProgress") },
                { value: "completed", label: t("appointments.statusOptions.completed") },
                { value: "cancelled", label: t("appointments.statusOptions.cancelled") },
                { value: "no-show", label: t("appointments.statusOptions.noShow") },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main View */}
      {viewMode === "list" ? (
        <DataTable
          columns={columns}
          data={data?.data}
          tableClassName="table-fixed min-w-[1072px]"
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          emptyTitle={t("appointments.emptyTitle")}
          emptyDescription={t("appointments.emptyDescription")}
          emptyActionLabel={t("appointments.book")}
          onEmptyAction={handleOpenBookModal}
          pagination={data?.pagination}
          onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
        />
      ) : (
        /* Agenda Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full py-12 text-center text-xs text-slate-muted">
              {t("appointments.loadingAgenda")}
            </div>
          ) : data?.data?.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs text-slate-muted">
              {t("appointments.emptyAgenda")}
            </div>
          ) : (
            data?.data?.map((apt) => {
              const p = typeof apt.patient === "object" && apt.patient ? apt.patient : null;
              const doc = typeof apt.doctor === "object" && apt.doctor ? apt.doctor : null;
              const u = doc && typeof doc.user === "object" && doc.user ? doc.user : null;
              const d = new Date(apt.appointmentDate);

              return (
                <div
                  key={apt._id}
                  className="p-4 rounded-xl bg-surface border border-border-subtle shadow-subtle flex flex-col justify-between gap-3 hover:border-border-medium transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-teal-dark bg-mint px-2 py-0.5 rounded-sm">
                        {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <StatusBadge status={apt.status} size="sm" />
                    </div>

                    <h4 className="text-sm font-semibold text-ink">
                      {p ? `${p.firstName} ${p.lastName}` : t("common.patient")}
                    </h4>
                    <p className="text-xs text-slate-muted mt-0.5">
                      {t("appointments.physician")}: {u ? `Dr. ${u.lastName}` : t("common.doctor")}
                    </p>

                    {apt.reason && (
                      <p className="text-xs text-slate-muted bg-paper p-2 rounded-md mt-2 leading-relaxed">
                        &ldquo;{apt.reason}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border-subtle/80 flex items-center justify-between text-xs text-slate-muted">
                    <span>{d.toLocaleDateString()}</span>
                    <span>{t("appointments.durationMinutes", { count: apt.duration })}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Book Appointment Modal */}
      <Modal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        title={t("appointments.bookModal.title")}
        subtitle={t("appointments.bookModal.subtitle")}
      >
        <form onSubmit={handleCreateAppointment} className="flex flex-col gap-4">
          {bookingError && (
            <div className="p-3 rounded-md bg-status-error-bg border border-status-error/20 text-xs text-status-error leading-relaxed">
              {bookingError}
            </div>
          )}

          <Select
            label={t("appointments.bookModal.selectPatient")}
            required
            value={bookingForm.patient}
            onChange={(e) =>
              setBookingForm({ ...bookingForm, patient: e.target.value })
            }
            options={
              patientsData?.data?.map((p) => ({
                value: p._id,
                label: `${p.firstName} ${p.lastName} (${p.phone})`,
              })) || []
            }
          />

          <Select
            label={t("appointments.bookModal.selectDoctor")}
            required
            value={bookingForm.doctor}
            onChange={(e) =>
              setBookingForm({ ...bookingForm, doctor: e.target.value })
            }
            options={
              doctorsData?.data?.map((d) => {
                const u = typeof d.user === "object" && d.user ? d.user : null;
                return {
                  value: d._id,
                  label: u
                    ? `Dr. ${u.firstName} ${u.lastName} (${d.specialization})`
                    : d.specialization,
                };
              }) || []
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t("appointments.bookModal.dateTime")}
              type="datetime-local"
              required
              value={bookingForm.appointmentDate}
              onChange={(e) =>
                setBookingForm({ ...bookingForm, appointmentDate: e.target.value })
              }
            />

            <Select
              label={t("appointments.bookModal.duration")}
              value={bookingForm.duration}
              onChange={(e) =>
                setBookingForm({
                  ...bookingForm,
                  duration: Number(e.target.value),
                })
              }
              options={[
                { value: 15, label: t("appointments.durationMinutes", { count: 15 }) },
                { value: 30, label: t("appointments.durationMinutes", { count: 30 }) },
                { value: 45, label: t("appointments.durationMinutes", { count: 45 }) },
                { value: 60, label: t("appointments.durationMinutes", { count: 60 }) },
              ]}
            />
          </div>

          <Input
            label={t("appointments.bookModal.reason")}
            value={bookingForm.reason}
            onChange={(e) =>
              setBookingForm({ ...bookingForm, reason: e.target.value })
            }
            placeholder={t("appointments.reasonPlaceholder")}
          />

          <Textarea
            label={t("appointments.bookModal.notes")}
            value={bookingForm.notes}
            onChange={(e) =>
              setBookingForm({ ...bookingForm, notes: e.target.value })
            }
            placeholder={t("appointments.notesPlaceholder")}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsBookModalOpen(false)}
             >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreating}
            >
              {t("appointments.bookModal.submit")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancellation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(cancelTargetId)}
        onClose={() => setCancelTargetId(null)}
        onConfirm={handleConfirmCancel}
        title={t("appointments.cancelDialog.title")}
        message={t("appointments.cancelDialog.message")}
        confirmText={t("appointments.cancelDialog.confirm")}
        variant="danger"
        isLoading={isCancelling}
      />
    </div>
  );
}
