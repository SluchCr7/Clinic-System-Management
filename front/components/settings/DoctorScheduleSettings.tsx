"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCalendarDays,
  LuCheck,
  LuClock,
  LuCoffee,
  LuPause,
  LuPlay,
  LuPlus,
  LuRefreshCw,
  LuBuilding2,
  LuTriangleAlert,
  LuSparkles,
} from "react-icons/lu";
import { Button, Card, CardContent, CardHeader, Input, Badge, toast } from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import {
  useGetSchedulesQuery,
  useCreateScheduleMutation,
  useUpdateScheduleMutation,
  useSyncClinicScheduleMutation,
} from "@/services/api/scheduleApi";
import { useGetMyClinicQuery } from "@/services/api/clinicApi";
import type { Schedule } from "@/types/schedule";
import type { OwnerClinicView } from "@/types/clinic";

const WEEK_DAYS = [
  { value: 0, key: "sunday" },
  { value: 1, key: "monday" },
  { value: 2, key: "tuesday" },
  { value: 3, key: "wednesday" },
  { value: 4, key: "thursday" },
  { value: 5, key: "friday" },
  { value: 6, key: "saturday" },
] as const;

interface ScheduleDraft {
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
}

const EMPTY_DRAFT: ScheduleDraft = {
  startTime: "09:00",
  endTime: "17:00",
  breakStart: "",
  breakEnd: "",
};

const toDraft = (schedule?: Schedule, defaultStart?: string | null, defaultEnd?: string | null): ScheduleDraft => ({
  startTime: schedule?.startTime ?? defaultStart ?? EMPTY_DRAFT.startTime,
  endTime: schedule?.endTime ?? defaultEnd ?? EMPTY_DRAFT.endTime,
  breakStart: schedule?.breakStart ?? "",
  breakEnd: schedule?.breakEnd ?? "",
});

export default function DoctorScheduleSettings() {
  const { t } = useTranslation();
  const {
    data: activeResponse,
    isLoading: isLoadingActive,
    isError: activeError,
    refetch: refetchActive,
  } = useGetSchedulesQuery({ isActive: true, limit: 50 });
  const {
    data: inactiveResponse,
    isLoading: isLoadingInactive,
    isError: inactiveError,
    refetch: refetchInactive,
  } = useGetSchedulesQuery({ isActive: false, limit: 50 });

  const { data: clinicResponse } = useGetMyClinicQuery();
  const clinic =
    clinicResponse?.data && "working_hours" in clinicResponse.data
      ? (clinicResponse.data as OwnerClinicView)
      : null;
  const clinicWorkingHours = clinic?.working_hours;

  const [createSchedule] = useCreateScheduleMutation();
  const [updateSchedule] = useUpdateScheduleMutation();
  const [syncClinicSchedule, { isLoading: isSyncingSchedule }] = useSyncClinicScheduleMutation();

  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [draft, setDraft] = useState<ScheduleDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const isLoading = isLoadingActive || isLoadingInactive;
  const isError = activeError || inactiveError;

  const schedules = useMemo(() => {
    const byDay = new Map<number, Schedule>();
    for (const schedule of [
      ...(activeResponse?.data ?? []),
      ...(inactiveResponse?.data ?? []),
    ]) {
      byDay.set(schedule.dayOfWeek, schedule);
    }
    return byDay;
  }, [activeResponse?.data, inactiveResponse?.data]);

  const activeCount = [...schedules.values()].filter(
    (schedule) => schedule.isActive
  ).length;

  const startEditing = (dayOfWeek: number) => {
    const dayKey = WEEK_DAYS.find((d) => d.value === dayOfWeek)?.key;
    const clinicDay = dayKey && clinicWorkingHours ? clinicWorkingHours[dayKey] : null;
    const existing = schedules.get(dayOfWeek);

    setEditingDay(dayOfWeek);
    setDraft(toDraft(existing, clinicDay?.open, clinicDay?.close));
  };

  const handleSyncWithClinic = async () => {
    try {
      await syncClinicSchedule().unwrap();
      void refetchActive();
      void refetchInactive();
      toast.success(
        t(
          "settings.schedule.syncSuccess",
          "Weekly schedule synchronized with clinic operating hours successfully with no conflicts."
        )
      );
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error(
        apiError.message ||
          t("settings.schedule.syncFailed", "Could not synchronize schedule with clinic.")
      );
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingDay === null) return;

    const dayKey = WEEK_DAYS.find((d) => d.value === editingDay)?.key;
    const clinicDay = dayKey && clinicWorkingHours ? clinicWorkingHours[dayKey] : null;

    if (clinicDay?.closed) {
      toast.error(
        t(
          "settings.schedule.clinicClosedError",
          "The clinic is closed on this day. Please update clinic hours in Clinic Settings to allow scheduling."
        )
      );
      return;
    }

    if (draft.startTime >= draft.endTime) {
      toast.error(t("settings.schedule.invalidHours", "End time must be later than start time."));
      return;
    }

    if (clinicDay?.open && clinicDay?.close) {
      if (draft.startTime < clinicDay.open || draft.endTime > clinicDay.close) {
        toast.error(
          t(
            "settings.schedule.outsideClinicError",
            "Doctor schedule must be within clinic hours ({{open}} – {{close}}).",
            { open: clinicDay.open, close: clinicDay.close }
          )
        );
        return;
      }
    }

    if (Boolean(draft.breakStart) !== Boolean(draft.breakEnd)) {
      toast.error(t("settings.schedule.incompleteBreak", "Enter both break times, or leave both blank."));
      return;
    }

    if (
      draft.breakStart &&
      (draft.breakStart >= draft.breakEnd ||
        draft.breakStart < draft.startTime ||
        draft.breakEnd > draft.endTime)
    ) {
      toast.error(t("settings.schedule.invalidBreak", "Break time must be within working hours."));
      return;
    }

    const schedule = schedules.get(editingDay);
    const data = {
      dayOfWeek: editingDay,
      startTime: draft.startTime,
      endTime: draft.endTime,
      breakStart: draft.breakStart || null,
      breakEnd: draft.breakEnd || null,
    };

    setIsSaving(true);
    try {
      if (schedule) {
        await updateSchedule({ id: schedule._id, data }).unwrap();
      } else {
        await createSchedule(data).unwrap();
      }
      setEditingDay(null);
      toast.success(t("settings.schedule.saved", "Weekly availability saved."));
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error(
        apiError.message ||
          t("settings.schedule.saveFailed", "Could not save your schedule.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (schedule: Schedule) => {
    const dayKey = WEEK_DAYS.find((d) => d.value === schedule.dayOfWeek)?.key;
    const clinicDay = dayKey && clinicWorkingHours ? clinicWorkingHours[dayKey] : null;

    if (!schedule.isActive && clinicDay?.closed) {
      toast.error(
        t(
          "settings.schedule.cannotActivateClosed",
          "Cannot activate availability on a day when the clinic is closed in Clinic Settings."
        )
      );
      return;
    }

    try {
      await updateSchedule({
        id: schedule._id,
        data: { isActive: !schedule.isActive },
      }).unwrap();
      toast.success(
        schedule.isActive
          ? t("settings.schedule.paused", "Availability paused.")
          : t("settings.schedule.resumed", "Availability resumed.")
      );
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error(
        apiError.message ||
          t("settings.schedule.updateFailed", "Could not update availability.")
      );
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-teal-primary/10 via-surface to-surface p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-primary/10 text-teal-primary">
                <LuCalendarDays className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base font-bold text-ink">
                    {t("settings.schedule.title", "Weekly availability")}
                  </h2>
                  {clinic && (
                    <Badge variant="teal" size="sm" className="flex items-center gap-1 font-medium">
                      <LuBuilding2 className="h-3 w-3" />
                      {t("settings.schedule.linkedClinic", "Linked to Clinic Schedule")}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-muted">
                  {t(
                    "settings.schedule.subtitle",
                    "Set the hours patients can book with you. Hours are synchronized with clinic operating settings to avoid booking conflicts."
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {clinicWorkingHours && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncWithClinic}
                  isLoading={isSyncingSchedule}
                  leftIcon={<LuRefreshCw className={`h-3.5 w-3.5 ${isSyncingSchedule ? "animate-spin" : ""}`} />}
                  className="border-teal-primary/30 text-teal-primary hover:bg-teal-primary/10 text-xs"
                >
                  {t("settings.schedule.syncClinicBtn", "Sync with clinic hours")}
                </Button>
              )}
              <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border-subtle bg-surface/80 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-status-success/10 text-status-success">
                  <LuCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-lg font-bold leading-none text-ink">{activeCount}</p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-muted">
                    {t("settings.schedule.activeDays", "Active days")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {WEEK_DAYS.map(({ value, key }) => {
          const schedule = schedules.get(value);
          const isEditing = editingDay === value;
          const clinicDay = clinicWorkingHours?.[key];
          const isClinicClosed = Boolean(clinicDay?.closed);
          const isClinicEmergencyOnly = Boolean(clinicDay?.emergency && !clinicDay?.open);
          const clinicRange = clinicDay?.open && clinicDay?.close ? `${clinicDay.open} – ${clinicDay.close}` : null;

          const hasConflict =
            schedule?.isActive &&
            (isClinicClosed ||
              isClinicEmergencyOnly ||
              (clinicDay?.open &&
                clinicDay?.close &&
                (schedule.startTime < clinicDay.open || schedule.endTime > clinicDay.close)));

          return (
            <Card
              key={value}
              className={`transition-colors ${
                hasConflict
                  ? "border-status-error/40 shadow-sm"
                  : schedule?.isActive
                    ? "border-teal-primary/25"
                    : ""
              }`}
            >
              <CardHeader
                title={
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        schedule?.isActive && !hasConflict
                          ? "bg-status-success"
                          : hasConflict
                            ? "bg-status-error animate-pulse"
                            : "bg-slate-light"
                      }`}
                    />
                    <span className="font-medium text-ink">{t(`days.${key}`)}</span>
                    {isClinicClosed ? (
                      <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-medium text-slate-muted border border-border-subtle">
                        {t("settings.schedule.clinicClosedBadge", "Clinic Closed")}
                      </span>
                    ) : isClinicEmergencyOnly ? (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 border border-amber-500/20">
                        {t("settings.schedule.emergencyBadge", "Emergency Only")}
                      </span>
                    ) : clinicRange ? (
                      <span className="text-[10px] text-slate-muted">
                        ({clinicRange})
                      </span>
                    ) : null}
                  </div>
                }
                action={
                  schedule && !isEditing ? (
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        hasConflict
                          ? "bg-status-error/10 text-status-error"
                          : schedule.isActive
                            ? "bg-status-success/10 text-status-success"
                            : "bg-paper text-slate-muted"
                      }`}
                    >
                      {hasConflict
                        ? t("settings.schedule.conflictBadge", "Conflict")
                        : schedule.isActive
                          ? t("common.active", "Active")
                          : t("common.inactive", "Inactive")}
                    </span>
                  ) : undefined
                }
              />
              <CardContent>
                {isLoading ? (
                  <div className="h-16 animate-pulse rounded-md bg-paper" />
                ) : isError ? (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-xs text-status-error">
                      {t("settings.schedule.loadFailed", "Could not load your schedule.")}
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void refetchActive();
                        void refetchInactive();
                      }}
                    >
                      {t("common.retry", "Retry")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Conflict Alerts */}
                    {hasConflict && (
                      <div className="flex items-center gap-2 rounded-lg bg-status-error/10 border border-status-error/20 p-2.5 text-xs text-status-error">
                        <LuTriangleAlert className="h-4 w-4 shrink-0" />
                        <span>
                          {isClinicClosed
                            ? t(
                                "settings.schedule.conflictClosedMsg",
                                "Clinic is marked closed on this day. Pause schedule or open the day in Clinic Settings."
                              )
                            : isClinicEmergencyOnly
                              ? t(
                                  "settings.schedule.conflictEmergencyMsg",
                                  "Clinic is emergency-only on this day with no regular hours."
                                )
                              : t(
                                  "settings.schedule.conflictHoursMsg",
                                  "Doctor hours ({{start}} – {{end}}) exceed clinic operating hours ({{clinic}}).",
                                  {
                                    start: schedule?.startTime,
                                    end: schedule?.endTime,
                                    clinic: clinicRange,
                                  }
                                )}
                        </span>
                      </div>
                    )}

                    {isEditing ? (
                      <form onSubmit={handleSave} className="flex flex-col gap-4">
                        {isClinicClosed && (
                          <div className="flex items-center gap-2 rounded-lg bg-paper border border-border-subtle p-2.5 text-xs text-slate-muted">
                            <LuTriangleAlert className="h-4 w-4 text-amber-500 shrink-0" />
                            <span>
                              {t(
                                "settings.schedule.editClosedWarning",
                                "Note: The clinic is closed on this day. You cannot set an active schedule until you open the day in Clinic Settings."
                              )}
                            </span>
                          </div>
                        )}

                        {clinicRange && (
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-teal-primary/5 border border-teal-primary/15 px-3 py-2 text-xs">
                            <span className="text-slate-muted">
                              {t("settings.schedule.allowedClinicRange", "Clinic operating hours:")}{" "}
                              <strong className="font-mono text-ink">{clinicRange}</strong>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-xs text-teal-primary hover:text-teal-primary h-7 px-2"
                              onClick={() => {
                                if (clinicDay?.open && clinicDay?.close) {
                                  setDraft((prev) => ({
                                    ...prev,
                                    startTime: clinicDay.open || prev.startTime,
                                    endTime: clinicDay.close || prev.endTime,
                                  }));
                                }
                              }}
                            >
                              <LuSparkles className="h-3 w-3 mr-1" />
                              {t("settings.schedule.useClinicHours", "Use clinic hours")}
                            </Button>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label={t("settings.schedule.startTime", "Start time")}
                            type="time"
                            value={draft.startTime}
                            min={clinicDay?.open || undefined}
                            max={clinicDay?.close || undefined}
                            onChange={(event) =>
                              setDraft((previous) => ({
                                ...previous,
                                startTime: event.target.value,
                              }))
                            }
                            required
                          />
                          <Input
                            label={t("settings.schedule.endTime", "End time")}
                            type="time"
                            value={draft.endTime}
                            min={clinicDay?.open || undefined}
                            max={clinicDay?.close || undefined}
                            onChange={(event) =>
                              setDraft((previous) => ({
                                ...previous,
                                endTime: event.target.value,
                              }))
                            }
                            required
                          />
                          <Input
                            label={t("settings.schedule.breakStart", "Break starts")}
                            type="time"
                            value={draft.breakStart}
                            onChange={(event) =>
                              setDraft((previous) => ({
                                ...previous,
                                breakStart: event.target.value,
                              }))
                            }
                          />
                          <Input
                            label={t("settings.schedule.breakEnd", "Break ends")}
                            type="time"
                            value={draft.breakEnd}
                            onChange={(event) =>
                              setDraft((previous) => ({
                                ...previous,
                                breakEnd: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingDay(null)}
                            disabled={isSaving}
                          >
                            {t("common.cancel", "Cancel")}
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            isLoading={isSaving}
                            leftIcon={<LuCheck className="h-3.5 w-3.5" />}
                          >
                            {t("common.saveChanges", "Save changes")}
                          </Button>
                        </div>
                      </form>
                    ) : schedule ? (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                          <LuClock className="h-4 w-4 text-teal-primary" />
                          <span className="font-mono">
                            {schedule.startTime} – {schedule.endTime}
                          </span>
                        </div>
                        {schedule.breakStart && schedule.breakEnd ? (
                          <div className="flex items-center gap-2 text-xs text-slate-muted">
                            <LuCoffee className="h-3.5 w-3.5" />
                            <span>
                              {t("settings.schedule.breakLabel", "Break")}:{" "}
                              <span className="font-mono">
                                {schedule.breakStart} – {schedule.breakEnd}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-light">
                            {t("settings.schedule.noBreak", "No break set")}
                          </p>
                        )}
                        <div className="flex justify-between gap-2 border-t border-border-subtle pt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={
                              schedule.isActive ? (
                                <LuPause className="h-3.5 w-3.5" />
                              ) : (
                                <LuPlay className="h-3.5 w-3.5" />
                              )
                            }
                            onClick={() => void handleToggle(schedule)}
                          >
                            {schedule.isActive
                              ? t("settings.schedule.pause", "Pause")
                              : t("settings.schedule.resume", "Resume")}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => startEditing(value)}
                          >
                            {t("common.edit", "Edit hours")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-24 flex-col items-start justify-center gap-3">
                        <p className="text-xs text-slate-muted">
                          {isClinicClosed
                            ? t("settings.schedule.clinicClosedDayOff", "Clinic is closed on this day.")
                            : t("settings.schedule.dayOff", "No availability set for this day.")}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<LuPlus className="h-3.5 w-3.5" />}
                          onClick={() => startEditing(value)}
                          disabled={isClinicClosed}
                        >
                          {t("settings.schedule.addHours", "Add hours")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-muted">
        {t(
          "settings.schedule.note",
          "Doctor schedule is governed by clinic operating hours. Pausing a day changes future availability only; existing appointments are not removed."
        )}
      </p>
    </div>
  );
}
