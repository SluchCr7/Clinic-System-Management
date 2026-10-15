"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCreateVisitMutation } from "@/services/api/visitApi";
import { useGetAppointmentsQuery } from "@/services/api/appointmentApi";
import {
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import { LuArrowLeft, LuSave } from "react-icons/lu";

export default function NewVisitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentIdFromUrl = searchParams.get("appointmentId");
  const { t } = useTranslation();
  const [createVisit, { isLoading }] = useCreateVisitMutation();

  const { data: appointmentsData, isLoading: isLoadingAppointments } = useGetAppointmentsQuery({
    limit: 100,
  });

  // Include in-progress appointments when resuming an unfinished encounter.
  const eligibleAppointments =
    appointmentsData?.data?.filter((a) =>
      ["checked_in", "confirmed", "scheduled", "in_progress"].includes(a.status)
    ) || [];

  const [selectedAppointmentId, setSelectedAppointmentId] = useState(
    appointmentIdFromUrl || ""
  );
  const effectiveAppointmentId =
    selectedAppointmentId || eligibleAppointments[0]?._id || "";
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [examination, setExamination] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [doctorNotes, setDoctorNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  // Vitals
  const [temperature, setTemperature] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [oxygenSaturation, setOxygenSaturation] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const appointment = appointmentsData?.data?.find(
      (a) => a._id === effectiveAppointmentId
    );

    if (!effectiveAppointmentId || !appointment) {
      setFormError(t("visits.consultation.requiredAppointment"));
      return;
    }

    if (!chiefComplaint.trim()) {
      setFormError(t("visits.consultation.requiredComplaint"));
      return;
    }

    const patientId =
      typeof appointment.patient === "object" && appointment.patient
        ? appointment.patient._id
        : (appointment.patient as string);

    const doctorId =
      typeof appointment.doctor === "object" && appointment.doctor
        ? appointment.doctor._id
        : (appointment.doctor as string);

    try {
      const payload = {
        appointment: effectiveAppointmentId,
        patient: patientId,
        doctor: doctorId,
        chiefComplaint: chiefComplaint.trim(),
        symptoms: symptoms
          ? symptoms.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        vitals: {
          temperature: temperature ? Number(temperature) : undefined,
          bloodPressure:
            systolic && diastolic
              ? { systolic: Number(systolic), diastolic: Number(diastolic) }
              : undefined,
          heartRate: heartRate ? Number(heartRate) : undefined,
          respiratoryRate: respiratoryRate ? Number(respiratoryRate) : undefined,
          oxygenSaturation: oxygenSaturation ? Number(oxygenSaturation) : undefined,
          weight: weight ? Number(weight) : undefined,
          height: height ? Number(height) : undefined,
        },
        examination: examination.trim() || undefined,
        diagnosis: diagnosis
          ? diagnosis.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        doctorNotes: doctorNotes.trim() || undefined,
        followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
      };

      const res = await createVisit(payload).unwrap();
      if (res.success) {
        toast.success(t("visits.consultation.success"));
        router.push("/visits");
      }
    } catch (err) {
      const extracted = extractApiError(err);
      setFormError(extracted.message || t("visits.consultation.submissionFailed"));
      toast.error(extracted.message || t("visits.consultation.operationFailed"));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-4xl mx-auto">
      <PageHeader
        title={t("visits.consultation.title")}
        subtitle={t("visits.consultation.subtitle")}
        backAction={
          <Link href="/visits">
            <Button variant="ghost" size="sm" leftIcon={<LuArrowLeft className="w-4 h-4" />}>
              {t("visits.consultation.back")}
            </Button>
          </Link>
        }
        actions={
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            leftIcon={<LuSave className="w-4 h-4" />}
          >
            {t("visits.consultation.submit")}
          </Button>
        }
      />

      {formError && (
        <div className="p-3.5 rounded-lg bg-status-error-bg border border-status-error/20 text-xs text-status-error leading-relaxed">
          {formError}
        </div>
      )}

      {/* Appointment Selection */}
      <Card>
        <CardHeader
          title={t("visits.consultation.appointmentContextTitle")}
          subtitle={t("visits.consultation.appointmentContextSubtitle")}
        />
        <CardContent>
          {eligibleAppointments.length === 0 && !isLoadingAppointments ? (
            <div className="p-3 rounded-md bg-paper border border-border-subtle text-xs text-slate-muted">
              {t("visits.consultation.noEligibleAppointments", {
                defaultValue: "No eligible checked-in or confirmed appointments found to begin a consultation.",
              })}
            </div>
          ) : (
            <Select
              label={t("visits.consultation.linkedAppointment")}
              required
              value={effectiveAppointmentId}
              onChange={(e) => setSelectedAppointmentId(e.target.value)}
              options={
                eligibleAppointments.map((a) => {
                  const p = typeof a.patient === "object" && a.patient ? a.patient : null;
                  const dateStr = new Date(a.appointmentDate).toLocaleString();
                  const statusLabel = a.status.replace("_", " ").toUpperCase();
                  return {
                    value: a._id,
                    label: `[${statusLabel}] ${dateStr} — ${p ? `${p.firstName} ${p.lastName}` : "Patient"} (${a.reason || "Visit"})`,
                  };
                })
              }
              placeholder={t("visits.consultation.appointmentPlaceholder")}
            />
          )}
        </CardContent>
      </Card>

      {/* Physiological Vitals */}
      <Card>
        <CardHeader
          title={t("visits.consultation.vitalsTitle")}
          subtitle={t("visits.consultation.vitalsSubtitle")}
        />
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input
            label={t("visits.consultation.temperature")}
            type="number"
            step="0.1"
            placeholder="37.0"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
          <Input
            label={t("visits.consultation.bpSystolic")}
            type="number"
            placeholder="120"
            value={systolic}
            onChange={(e) => setSystolic(e.target.value)}
          />
          <Input
            label={t("visits.consultation.bpDiastolic")}
            type="number"
            placeholder="80"
            value={diastolic}
            onChange={(e) => setDiastolic(e.target.value)}
          />
          <Input
            label={t("visits.consultation.heartRate")}
            type="number"
            placeholder="72"
            value={heartRate}
            onChange={(e) => setHeartRate(e.target.value)}
          />
          <Input
            label={t("visits.consultation.respiratoryRate")}
            type="number"
            placeholder="16"
            value={respiratoryRate}
            onChange={(e) => setRespiratoryRate(e.target.value)}
          />
          <Input
            label={t("visits.consultation.oxygenSaturation")}
            type="number"
            placeholder="98"
            value={oxygenSaturation}
            onChange={(e) => setOxygenSaturation(e.target.value)}
          />
          <Input
            label={t("visits.consultation.weight")}
            type="number"
            step="0.5"
            placeholder="75.0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Input
            label={t("visits.consultation.height")}
            type="number"
            placeholder="175"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Clinical Notes & Diagnosis */}
      <Card>
        <CardHeader
          title={t("visits.consultation.notesTitle")}
          subtitle={t("visits.consultation.notesSubtitle")}
        />
        <CardContent className="flex flex-col gap-4">
          <Input
            label={t("visits.consultation.chiefComplaint")}
            required
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="Primary reason patient presents today"
          />

          <Input
            label={t("visits.consultation.symptoms")}
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Separate with commas (e.g., Fever, Sore throat, Fatigue)"
          />

          <Textarea
            label={t("visits.consultation.examination")}
            rows={3}
            value={examination}
            onChange={(e) => setExamination(e.target.value)}
            placeholder="Chest clear, abdomen soft and non-tender, HEENT normal..."
          />

          <Input
            label={t("visits.consultation.diagnosis")}
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Separate multiple diagnoses with commas (e.g., Acute viral pharyngitis, J02.9)"
          />

          <Textarea
            label={t("visits.consultation.doctorNotes")}
            rows={4}
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            placeholder="Treatment strategy, patient advice, lifestyle recommendations..."
          />

          <div className="max-w-xs">
            <Input
              label={t("visits.consultation.followUpDate")}
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            leftIcon={<LuSave className="w-4 h-4" />}
          >
            {t("visits.consultation.submit")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
