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
} from "react-icons/lu";
import { Button, Card, CardContent, CardHeader, Input, toast } from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import {
  useGetSchedulesQuery,
  useCreateScheduleMutation,
  useUpdateScheduleMutation,
} from "@/services/api/scheduleApi";
import type { Schedule } from "@/types/schedule";

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

const toDraft = (schedule?: Schedule): ScheduleDraft => ({
  startTime: schedule?.startTime ?? EMPTY_DRAFT.startTime,
  endTime: schedule?.endTime ?? EMPTY_DRAFT.endTime,
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
  const [createSchedule] = useCreateScheduleMutation();
  const [updateSchedule] = useUpdateScheduleMutation();
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
    setEditingDay(dayOfWeek);
    setDraft(toDraft(schedules.get(dayOfWeek)));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingDay === null) return;

    if (draft.startTime >= draft.endTime) {
      toast.error(t("settings.schedule.invalidHours", "End time must be later than start time."));
      return;
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
                <h2 className="text-base font-bold text-ink">
                  {t("settings.schedule.title", "Weekly availability")}
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-muted">
                  {t(
                    "settings.schedule.subtitle",
                    "Set the hours patients can book with you. Add your regular clinic hours and optional break for each day."
                  )}
                </p>
              </div>
            </div>
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
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {WEEK_DAYS.map(({ value, key }) => {
          const schedule = schedules.get(value);
          const isEditing = editingDay === value;

          return (
            <Card
              key={value}
              className={`transition-colors ${
                schedule?.isActive
                  ? "border-teal-primary/25"
                  : ""
              }`}
            >
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        schedule?.isActive
                          ? "bg-status-success"
                          : "bg-slate-light"
                      }`}
                    />
                    {t(`days.${key}`)}
                  </span>
                }
                action={
                  schedule && !isEditing ? (
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        schedule.isActive
                          ? "bg-status-success/10 text-status-success"
                          : "bg-paper text-slate-muted"
                      }`}
                    >
                      {schedule.isActive
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
                ) : isEditing ? (
                  <form onSubmit={handleSave} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label={t("settings.schedule.startTime", "Start time")}
                        type="time"
                        value={draft.startTime}
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
                      {t("settings.schedule.dayOff", "No availability set for this day.")}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<LuPlus className="h-3.5 w-3.5" />}
                      onClick={() => startEditing(value)}
                    >
                      {t("settings.schedule.addHours", "Add hours")}
                    </Button>
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
          "Pausing a day changes future availability only; existing appointments are not removed."
        )}
      </p>
    </div>
  );
}
