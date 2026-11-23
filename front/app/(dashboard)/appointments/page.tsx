"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetAppointmentsQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
  useCancelAppointmentMutation,
} from "@/services/api/appointmentApi";
import { useGetPatientsQuery } from "@/services/api/patientApi";
import {
  useGetDoctorsQuery,
  useGetDoctorAvailabilityQuery,
} from "@/services/api/doctorApi";
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
  LuEllipsisVertical,
} from "react-icons/lu";
import OptionsAppointmentMenu from "@/components/menus/optionsAppointmentMenu";

export default function AppointmentsPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";
  const role = useAppSelector(selectUserRole);
  const canCreateAppointment = hasPermission(role, "appointments.create");
  const canEditAppointment = hasPermission(role, "appointments.edit");
  const [viewMode, setViewMode] = useState<"list" | "agenda">("list");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  
  // State for active dropdown menu in table rows
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const handleStatusTransition = async (id: string, newStatus: AppointmentStatus) => {
    setActiveMenuId(null);
    try {
      await updateAppointment({
        id,
        data: { status: newStatus },
      }).unwrap();
      toast.success(t("appointments.success.statusUpdated"));
      return true;
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("appointments.errors.updateStatusFailed"));
      return false;
    }
  };

  const handleStartVisit = async (id: string) => {
    setActiveMenuId(null);
    router.push(`/visits/new?appointmentId=${id}`);
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
  const [bookingAlternatives, setBookingAlternatives] = useState<
    Array<{ start: string; end: string }>
  >([]);

  const availabilityDate = bookingForm.appointmentDate
    ? bookingForm.appointmentDate.slice(0, 10)
    : "";
  const { data: availabilityData } = useGetDoctorAvailabilityQuery(
    {
      doctorId: bookingForm.doctor,
      date: availabilityDate,
      duration: bookingForm.duration,
    },
    {
      skip:
        !isBookModalOpen ||
        !bookingForm.doctor ||
        !availabilityDate,
      pollingInterval: 60_000,
    }
  );

  // Cancellation Dialog State
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState<string | undefined>();

  const handleOpenCancelDialog = (id: string) => {
    setCancelReason("");
    setCancelReasonError(undefined);
    setCancelTargetId(id);
  };

  const handleCloseCancelDialog = () => {
    setCancelTargetId(null);
    setCancelReason("");
    setCancelReasonError(undefined);
  };

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
    setBookingAlternatives([]);
    setIsBookModalOpen(true);
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!bookingForm.patient || !bookingForm.doctor || !bookingForm.appointmentDate) {
      setBookingError(t("appointments.errors.missingBookingInfo"));
      return;
    }

    if (bookingForm.appointmentDate < formatClinicDateTimeForInput(new Date())) {
      setBookingError(t("appointments.errors.pastDate"));
      return;
    }

    const duration = Number(bookingForm.duration);
    if (!Number.isInteger(duration) || duration < 5 || duration > 240) {
      setBookingError(t("appointments.errors.invalidDuration"));
      return;
    }

    try {
      const payload = {
        patient: bookingForm.patient,
        doctor: bookingForm.doctor,
        appointmentDate: bookingForm.appointmentDate,
        duration,
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
      setBookingAlternatives(extracted.nextAvailableSlots || []);
      toast.error(extracted.message || t("appointments.errors.bookingFailed"));
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cancelTargetId) return;

    const cancellationReason = cancelReason.trim();
    if (!cancellationReason) {
      setCancelReasonError(t("appointments.errors.cancellationReasonRequired"));
      return;
    }

    try {
      await cancelAppointment({ id: cancelTargetId, cancellationReason }).unwrap();
      toast.success(t("appointments.success.cancelled"));
      handleCloseCancelDialog();
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
              {d.toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="text-[11px] text-slate-muted font-mono flex items-center gap-1">
              <LuClock className="w-3 h-3 text-slate-light" />
              {d.toLocaleTimeString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" })}
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
            {doc?.clinic && typeof doc.clinic === "object" && (
              <p className="truncate text-[10px] text-slate-muted">
                {doc.clinic.name}
              </p>
            )}
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
      className: "w-[80px] min-w-[80px] overflow-visible whitespace-nowrap relative",
      render: (apt) => {
        const canOpenMenu =
          (role === "receptionist" && canEditAppointment) ||
          (role === "doctor" &&
            ["checked_in", "in_progress"].includes(apt.status));

        if (
          !canOpenMenu ||
          apt.status === "cancelled" ||
          apt.status === "completed"
        ) {
          return null;
        }

        const isOpen = activeMenuId === apt._id;

        return (
          <div className="relative flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              ref={isOpen ? menuButtonRef : null}
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuId(isOpen ? null : apt._id);
              }}
              className="p-1.5 text-slate-muted hover:text-ink hover:bg-surface border border-transparent hover:border-border-subtle rounded-md"
              title={t("common.actions")}
            >
              <LuEllipsisVertical className="w-4 h-4" />
            </Button>

            {isOpen && (
              <OptionsAppointmentMenu
                apt={apt}
                role={role}
                isRtl={isRtl}
                isUpdating={isUpdating}
                handleStatusTransition={handleStatusTransition}
                handleStartVisit={handleStartVisit}
                setActiveMenuId={setActiveMenuId}
                setCancelTargetId={handleOpenCancelDialog}
                anchorRef={menuButtonRef}
                t={t}
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full max-w-full overflow-x-hidden p-2 sm:p-4 md:p-6">
      <PageHeader
        title={t("appointments.title")}
        subtitle={t("appointments.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
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
            className="w-full sm:max-w-xs"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="w-full sm:w-36">
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
        <div className="w-full overflow-x-auto">
          <DataTable
            columns={columns}
            data={data?.data}
            tableClassName="table-fixed min-w-[892px]"
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
        </div>
      ) : (
        /* Agenda Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        {d.toLocaleTimeString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <StatusBadge status={apt.status} size="sm" />
                    </div>

                    <h4 className="text-sm font-semibold text-ink truncate">
                      {p ? `${p.firstName} ${p.lastName}` : t("common.patient")}
                    </h4>
                    <p className="text-xs text-slate-muted mt-0.5 truncate">
                      {t("appointments.physician")}: {u ? `Dr. ${u.lastName}` : t("common.doctor")}
                    </p>
                    {doc?.clinic && typeof doc.clinic === "object" && (
                      <p className="text-[11px] text-slate-muted mt-0.5 truncate">
                        {t("settings.clinicTab", "Clinic")}: {doc.clinic.name}
                      </p>
                    )}

                    {apt.reason && (
                      <p className="text-xs text-slate-muted bg-paper p-2 rounded-md mt-2 leading-relaxed truncate">
                        &ldquo;{apt.reason}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border-subtle/80 flex items-center justify-between text-xs text-slate-muted">
                    <span>{d.toLocaleDateString(isRtl ? "ar-EG" : "en-US")}</span>
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
              min={formatClinicDateTimeForInput(new Date())}
              required
              value={bookingForm.appointmentDate}
              onChange={(e) =>
                setBookingForm({ ...bookingForm, appointmentDate: e.target.value })
              }
            />

            <Input
              label={t("appointments.bookModal.duration")}
              type="number"
              min={5}
              max={240}
              step={1}
              required
              value={bookingForm.duration}
              onChange={(e) =>
                setBookingForm({
                  ...bookingForm,
                  duration: Number(e.target.value),
                })
              }
            />
          </div>

          {(availabilityData?.data?.availableSlots?.length ?? 0) > 0 && (
            <div className="p-3 rounded-md bg-paper border border-border-subtle">
              <p className="text-[10px] font-semibold text-slate-muted mb-2">
                {t("appointments.bookModal.availableSlots")}
              </p>
              <div className="flex flex-wrap gap-2">
                {(availabilityData?.data?.availableSlots || []).slice(0, 6).map((slot) => (
                  <Button
                    key={slot.start}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setBookingAlternatives([]);
                      setBookingForm((previous) => ({
                        ...previous,
                        appointmentDate: formatClinicDateTimeForInput(new Date(slot.start)),
                      }));
                    }}
                  >
                    {new Date(slot.start).toLocaleTimeString(
                      isRtl ? "ar-EG" : "en-US",
                      { hour: "numeric", minute: "2-digit" }
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {bookingAlternatives.length > 0 && (
            <div className="p-3 rounded-md bg-status-warning-bg border border-status-warning/20">
              <p className="text-[10px] font-semibold text-status-warning mb-2">
                {t("appointments.bookModal.alternativeSlots")}
              </p>
              <div className="flex flex-wrap gap-2">
                {bookingAlternatives.map((slot) => (
                  <Button
                    key={slot.start}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBookingAlternatives([]);
                      setBookingError(null);
                      setBookingForm((previous) => ({
                        ...previous,
                        appointmentDate: formatClinicDateTimeForInput(new Date(slot.start)),
                      }));
                    }}
                  >
                    {new Date(slot.start).toLocaleTimeString(
                      isRtl ? "ar-EG" : "en-US",
                      { hour: "numeric", minute: "2-digit" }
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

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
      <Modal
        isOpen={Boolean(cancelTargetId)}
        onClose={handleCloseCancelDialog}
        title={t("appointments.cancelDialog.title")}
        size="sm"
      >
        <form onSubmit={handleConfirmCancel} className="flex flex-col gap-4">
          <p className="text-xs text-slate-muted leading-relaxed">
            {t("appointments.cancelDialog.message")}
          </p>
          <Textarea
            label={t("appointments.cancelDialog.reason")}
            placeholder={t("appointments.cancelDialog.reasonPlaceholder")}
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value);
              setCancelReasonError(undefined);
            }}
            error={cancelReasonError}
            required
            rows={3}
          />
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCloseCancelDialog}
              disabled={isCancelling}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isCancelling}
            >
              {t("appointments.cancelDialog.confirm")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}