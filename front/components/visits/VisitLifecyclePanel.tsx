"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useCompleteVisitMutation,
  useUpdateVisitMutation,
} from "@/services/api/visitApi";
import {
  useCreateAppointmentMutation,
  useGetAppointmentsQuery,
} from "@/services/api/appointmentApi";
import type { Visit, Vitals } from "@/types/visit";
import { extractApiError } from "@/services/api/baseQuery";
import { Button, Card, CardContent, CardHeader, Input, Textarea, toast } from "@/components/ui";

interface VisitLifecyclePanelProps {
  visit: Visit;
  role?: string;
}

const getId = (value: { _id: string } | string) =>
  typeof value === "string" ? value : value._id;

const getClinicDateTimeValue = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(" ", "T");

const getDefaultAppointmentDate = (recommendedDate?: string | null) => {
  if (recommendedDate) {
    return `${recommendedDate.slice(0, 10)}T10:00`;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  return getClinicDateTimeValue(tomorrow);
};

const VisitLifecyclePanel = ({ visit, role }: VisitLifecyclePanelProps) => {
  const { t } = useTranslation();
  const [updateVisit, { isLoading: isSaving }] = useUpdateVisitMutation();
  const [completeVisit, { isLoading: isCompleting }] = useCompleteVisitMutation();
  const [createAppointment, { isLoading: isBooking }] =
    useCreateAppointmentMutation();
  const { data: followUpData } = useGetAppointmentsQuery(
    { originatingVisit: visit._id, page: 1, limit: 10 },
    { skip: !visit._id }
  );
  const followUpAppointments = followUpData?.data ?? [];
  const activeFollowUp = followUpAppointments.find(
    (appointment) =>
      appointment.status !== "cancelled" && appointment.status !== "no-show"
  );
  const bookedFollowUp = activeFollowUp ?? followUpAppointments[0];
  const canEdit = role === "doctor" && visit.status === "in_progress";
  const canBookFollowUp =
    role === "doctor" &&
    visit.status === "completed" &&
    Boolean(visit.followUpDate || visit.followUpReason) &&
    !activeFollowUp;

  const [chiefComplaint, setChiefComplaint] = useState(visit.chiefComplaint);
  const [symptoms, setSymptoms] = useState(visit.symptoms.join(", "));
  const [examination, setExamination] = useState(visit.examination || "");
  const [diagnosis, setDiagnosis] = useState(visit.diagnosis.join(", "));
  const [doctorNotes, setDoctorNotes] = useState(visit.doctorNotes || "");
  const [followUpDate, setFollowUpDate] = useState(
    visit.followUpDate?.slice(0, 10) || ""
  );
  const [followUpReason, setFollowUpReason] = useState(
    visit.followUpReason || ""
  );
  const [vitals, setVitals] = useState<Vitals>(visit.vitals || {});
  const [bookingDate, setBookingDate] = useState("");
  const [bookingDuration, setBookingDuration] = useState("30");
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);

  const updateVital = (field: keyof Omit<Vitals, "bloodPressure">, value: string) => {
    setVitals((current) => ({
      ...current,
      [field]: value === "" ? undefined : Number(value),
    }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const systolic = vitals.bloodPressure?.systolic;
    const diastolic = vitals.bloodPressure?.diastolic;
    if ((systolic === undefined) !== (diastolic === undefined)) {
      toast.error(t("visits.workflow.bloodPressurePairRequired"));
      return;
    }

    try {
      await updateVisit({
        id: visit._id,
        data: {
          chiefComplaint: chiefComplaint.trim(),
          symptoms: symptoms.split(",").map((item) => item.trim()).filter(Boolean),
          vitals,
          examination: examination.trim() || null,
          diagnosis: diagnosis.split(",").map((item) => item.trim()).filter(Boolean),
          doctorNotes: doctorNotes.trim() || null,
          followUpDate: followUpDate
            ? new Date(`${followUpDate}T00:00:00.000Z`).toISOString()
            : null,
          followUpReason: followUpReason.trim() || null,
        },
      }).unwrap();
      toast.success(t("visits.workflow.saved"));
    } catch (error) {
      toast.error(
        extractApiError(error).message || t("visits.workflow.saveFailed")
      );
    }
  };

  const handleComplete = async () => {
    try {
      await completeVisit(visit._id).unwrap();
      toast.success(t("visits.workflow.completed"));
    } catch (error) {
      toast.error(
        extractApiError(error).message || t("visits.workflow.completeFailed")
      );
    }
  };

  const handleBookFollowUp = async (event: React.FormEvent) => {
    event.preventDefault();
    const patientId = getId(visit.patient);
    const doctorId = getId(visit.doctor);
    const sourceAppointmentId = getId(visit.appointment);
    if (!bookingDate || !Number.isInteger(Number(bookingDuration))) {
      toast.error(t("visits.workflow.bookingDetailsRequired"));
      return;
    }

    try {
      await createAppointment({
        patient: patientId,
        doctor: doctorId,
        appointmentDate: bookingDate,
        duration: Number(bookingDuration),
        reason: t("appointments.followUpReason"),
        followUpReason: visit.followUpReason || undefined,
        isFollowUp: true,
        originatingVisit: visit._id,
        followUpOf: sourceAppointmentId,
      }).unwrap();
      setIsBookingFormOpen(false);
      toast.success(t("visits.workflow.followUpBooked"));
    } catch (error) {
      toast.error(
        extractApiError(error).message || t("visits.workflow.bookingFailed")
      );
    }
  };

  const setBloodPressure = (field: "systolic" | "diastolic", value: string) => {
    setVitals((current) => ({
      ...current,
      bloodPressure: {
        ...current.bloodPressure,
        [field]: value === "" ? undefined : Number(value),
      },
    }));
  };

  return (
    <Card className="border-border-subtle">
      <CardHeader
        title={t("visits.workflow.title")}
        subtitle={t("visits.workflow.subtitle")}
        action={
          <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold capitalize text-ink">
            {t(`visits.workflow.status.${visit.status}`)}
          </span>
        }
      />
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-muted">
          <span>
            {t("visits.workflow.started")}:{" "}
            {visit.startedAt ? new Date(visit.startedAt).toLocaleString() : "-"}
          </span>
          {visit.completedAt && (
            <span>
              {t("visits.workflow.completedAt")}:{" "}
              {new Date(visit.completedAt).toLocaleString()}
            </span>
          )}
        </div>

        {visit.statusHistory.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-muted">
            {visit.statusHistory.map((entry, index) => (
              <span key={`${entry.changedAt}-${index}`}>
                {entry.from
                  ? t(`visits.workflow.status.${entry.from}`)
                  : t("visits.workflow.status.started")}
                {" → "}
                {t(`visits.workflow.status.${entry.to}`)} ·{" "}
                {new Date(entry.changedAt).toLocaleString()}
              </span>
            ))}
          </div>
        )}

        {canEdit && (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <Input
              label={t("visits.consultation.chiefComplaint")}
              required
              value={chiefComplaint}
              onChange={(event) => setChiefComplaint(event.target.value)}
            />
            <Input
              label={t("visits.consultation.symptoms")}
              value={symptoms}
              onChange={(event) => setSymptoms(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Input
                label={t("visits.consultation.temperature")}
                type="number"
                step="0.1"
                value={vitals.temperature ?? ""}
                onChange={(event) => updateVital("temperature", event.target.value)}
              />
              <Input
                label={t("visits.consultation.bpSystolic")}
                type="number"
                value={vitals.bloodPressure?.systolic ?? ""}
                onChange={(event) => setBloodPressure("systolic", event.target.value)}
              />
              <Input
                label={t("visits.consultation.bpDiastolic")}
                type="number"
                value={vitals.bloodPressure?.diastolic ?? ""}
                onChange={(event) => setBloodPressure("diastolic", event.target.value)}
              />
              <Input
                label={t("visits.consultation.heartRate")}
                type="number"
                value={vitals.heartRate ?? ""}
                onChange={(event) => updateVital("heartRate", event.target.value)}
              />
              <Input
                label={t("visits.consultation.respiratoryRate")}
                type="number"
                value={vitals.respiratoryRate ?? ""}
                onChange={(event) => updateVital("respiratoryRate", event.target.value)}
              />
              <Input
                label={t("visits.consultation.oxygenSaturation")}
                type="number"
                value={vitals.oxygenSaturation ?? ""}
                onChange={(event) => updateVital("oxygenSaturation", event.target.value)}
              />
              <Input
                label={t("visits.consultation.weight")}
                type="number"
                step="0.1"
                value={vitals.weight ?? ""}
                onChange={(event) => updateVital("weight", event.target.value)}
              />
              <Input
                label={t("visits.consultation.height")}
                type="number"
                value={vitals.height ?? ""}
                onChange={(event) => updateVital("height", event.target.value)}
              />
            </div>
            <Textarea
              label={t("visits.consultation.examination")}
              rows={3}
              value={examination}
              onChange={(event) => setExamination(event.target.value)}
            />
            <Input
              label={t("visits.consultation.diagnosis")}
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
            />
            <Textarea
              label={t("visits.consultation.doctorNotes")}
              rows={3}
              value={doctorNotes}
              onChange={(event) => setDoctorNotes(event.target.value)}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label={t("visits.consultation.followUpDate")}
                type="date"
                value={followUpDate}
                onChange={(event) => setFollowUpDate(event.target.value)}
              />
              <Textarea
                label={t("visits.consultation.followUpReason")}
                rows={2}
                value={followUpReason}
                onChange={(event) => setFollowUpReason(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="submit" variant="outline" isLoading={isSaving}>
                {t("visits.workflow.save")}
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={isCompleting}
                onClick={handleComplete}
              >
                {t("visits.workflow.completeVisit")}
              </Button>
            </div>
          </form>
        )}

        {(visit.followUpDate || visit.followUpReason) && (
          <div className="rounded-lg border border-border-subtle bg-paper p-3 text-xs">
            <strong>{t("visits.workflow.recommendation")}</strong>
            {visit.followUpDate && (
              <span className="ms-2">
                {new Date(visit.followUpDate).toLocaleDateString()}
              </span>
            )}
            {visit.followUpReason && (
              <p className="mt-1 text-slate-muted">{visit.followUpReason}</p>
            )}
          </div>
        )}

        {bookedFollowUp && (
          <div className="rounded-lg border border-border-subtle bg-paper p-3 text-xs">
            <strong>{t("visits.workflow.bookedFollowUp")}</strong>
            <span className="ms-2 capitalize">
              {t(
                `appointments.statusOptions.${
                  bookedFollowUp.status === "checked_in"
                    ? "checkedIn"
                    : bookedFollowUp.status === "in_progress"
                      ? "inProgress"
                    : bookedFollowUp.status === "no-show"
                      ? "noShow"
                      : bookedFollowUp.status
                }`,
                { defaultValue: bookedFollowUp.status.replace("_", " ") }
              )}
            </span>
            <p className="mt-1 text-slate-muted">
              {new Date(bookedFollowUp.appointmentDate).toLocaleString()}
            </p>
          </div>
        )}

        {canBookFollowUp &&
          (isBookingFormOpen ? (
            <form
              onSubmit={handleBookFollowUp}
              className="grid gap-3 rounded-lg border border-border-subtle p-4 md:grid-cols-[1fr_150px_auto]"
            >
              <Input
                label={t("visits.workflow.bookingDate")}
                type="datetime-local"
                required
                min={getClinicDateTimeValue(new Date())}
                value={bookingDate}
                onChange={(event) => setBookingDate(event.target.value)}
              />
              <Input
                label={t("appointments.duration")}
                type="number"
                min={5}
                max={240}
                value={bookingDuration}
                onChange={(event) => setBookingDuration(event.target.value)}
              />
              <div className="flex items-end">
                <Button type="submit" isLoading={isBooking}>
                  {t("visits.workflow.bookFollowUp")}
                </Button>
              </div>
            </form>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBookingDate(getDefaultAppointmentDate(visit.followUpDate));
                setIsBookingFormOpen(true);
              }}
            >
              {t("visits.workflow.bookFollowUp")}
            </Button>
          ))}
      </CardContent>
    </Card>
  );
};

export default VisitLifecyclePanel;
