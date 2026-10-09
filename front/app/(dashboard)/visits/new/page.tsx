"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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
  const [createVisit, { isLoading }] = useCreateVisitMutation();

  const { data: appointmentsData } = useGetAppointmentsQuery({
    limit: 50,
    status: "confirmed",
  });

  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
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
      (a) => a._id === selectedAppointmentId
    );

    if (!selectedAppointmentId || !appointment) {
      setFormError("Please link a valid confirmed appointment to begin consultation.");
      return;
    }

    if (!chiefComplaint.trim()) {
      setFormError("Chief complaint is mandatory for medical documentation.");
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
        appointment: selectedAppointmentId,
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
        toast.success("Clinical consultation recorded successfully.");
        router.push("/visits");
      }
    } catch (err) {
      const extracted = extractApiError(err);
      setFormError(extracted.message || "Failed to record consultation.");
      toast.error(extracted.message || "Operation failed.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-4xl mx-auto">
      <PageHeader
        title="Record Clinical Consultation"
        subtitle="Physician examination notes, physiological vitals, and diagnosis"
        backAction={
          <Link href="/visits">
            <Button variant="ghost" size="sm" leftIcon={<LuArrowLeft className="w-4 h-4" />}>
              Back
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
            Complete Consultation
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
          title="1. Appointment Context"
          subtitle="Select the scheduled appointment being attended"
        />
        <CardContent>
          <Select
            label="Linked Appointment"
            required
            value={selectedAppointmentId}
            onChange={(e) => setSelectedAppointmentId(e.target.value)}
            options={
              appointmentsData?.data?.map((a) => {
                const p = typeof a.patient === "object" && a.patient ? a.patient : null;
                const dateStr = new Date(a.appointmentDate).toLocaleString();
                return {
                  value: a._id,
                  label: `${dateStr} — ${p ? `${p.firstName} ${p.lastName}` : "Patient"} (${a.reason || "Visit"})`,
                };
              }) || []
            }
            placeholder="Choose confirmed appointment..."
          />
        </CardContent>
      </Card>

      {/* Physiological Vitals */}
      <Card>
        <CardHeader
          title="2. Physiological Vitals"
          subtitle="Nurse triage and physical measurements"
        />
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input
            label="Temp (°C)"
            type="number"
            step="0.1"
            placeholder="37.0"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
          <Input
            label="BP Systolic"
            type="number"
            placeholder="120"
            value={systolic}
            onChange={(e) => setSystolic(e.target.value)}
          />
          <Input
            label="BP Diastolic"
            type="number"
            placeholder="80"
            value={diastolic}
            onChange={(e) => setDiastolic(e.target.value)}
          />
          <Input
            label="Heart Rate (bpm)"
            type="number"
            placeholder="72"
            value={heartRate}
            onChange={(e) => setHeartRate(e.target.value)}
          />
          <Input
            label="Resp. Rate (/min)"
            type="number"
            placeholder="16"
            value={respiratoryRate}
            onChange={(e) => setRespiratoryRate(e.target.value)}
          />
          <Input
            label="SpO2 (%)"
            type="number"
            placeholder="98"
            value={oxygenSaturation}
            onChange={(e) => setOxygenSaturation(e.target.value)}
          />
          <Input
            label="Weight (kg)"
            type="number"
            step="0.5"
            placeholder="75.0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Input
            label="Height (cm)"
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
          title="3. Physician Notes & Diagnosis"
          subtitle="Clinical assessment, symptoms, and medical impressions"
        />
        <CardContent className="flex flex-col gap-4">
          <Input
            label="Chief Complaint"
            required
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="Primary reason patient presents today"
          />

          <Input
            label="Reported Symptoms"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Separate with commas (e.g., Fever, Sore throat, Fatigue)"
          />

          <Textarea
            label="Physical Examination Findings"
            rows={3}
            value={examination}
            onChange={(e) => setExamination(e.target.value)}
            placeholder="Chest clear, abdomen soft and non-tender, HEENT normal..."
          />

          <Input
            label="Clinical Diagnosis"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Separate multiple diagnoses with commas (e.g., Acute viral pharyngitis, J02.9)"
          />

          <Textarea
            label="Doctor Confidential Notes & Treatment Plan"
            rows={4}
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            placeholder="Treatment strategy, patient advice, lifestyle recommendations..."
          />

          <div className="max-w-xs">
            <Input
              label="Recommended Follow-Up Date"
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
            Save Clinical Record
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
