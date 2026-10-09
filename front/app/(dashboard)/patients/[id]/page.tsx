"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useGetPatientByIdQuery } from "@/services/api/patientApi";
import { useGetAppointmentsQuery } from "@/services/api/appointmentApi";
import { useGetVisitsQuery } from "@/services/api/visitApi";
import { useGetPrescriptionsQuery } from "@/services/api/prescriptionApi";
import { useGetLabOrdersQuery } from "@/services/api/labOrderApi";
import { useGetMedicalAttachmentsQuery } from "@/services/api/medicalAttachmentApi";
import { useGetInvoicesQuery } from "@/services/api/invoiceApi";
import {
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Tabs,
  StatusBadge,
  DataTable,
  Button,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import {
  LuArrowLeft,
  LuPhone,
  LuMail,
  LuMapPin,
  LuTriangleAlert,
  LuShieldAlert,
  LuCalendar,
  LuClipboardCheck,
  LuFileText,
  LuFlaskConical,
  LuPaperclip,
  LuReceipt,
  LuPlus,
} from "react-icons/lu";

export default function PatientProfilePage() {
  const { t } = useTranslation();
  const params = useParams();
  const patientId = params.id as string;

  const [activeTab, setActiveTab] = useState("overview");

  const { data: patientData, isLoading, isError, refetch } =
    useGetPatientByIdQuery(patientId);
  const patient = patientData?.data;

  // Sub-queries for patient tabs
  const { data: appointmentsData, isLoading: isAptsLoading } =
    useGetAppointmentsQuery({ patient: patientId, limit: 10 });

  const { data: visitsData, isLoading: isVisitsLoading } =
    useGetVisitsQuery({ patient: patientId, limit: 10 });

  const { data: prescriptionsData, isLoading: isRxsLoading } =
    useGetPrescriptionsQuery({ patient: patientId, limit: 10 });

  const { data: labOrdersData, isLoading: isLabsLoading } =
    useGetLabOrdersQuery({ patient: patientId, limit: 10 });

  const { data: attachmentsData, isLoading: isFilesLoading } =
    useGetMedicalAttachmentsQuery({ patient: patientId, limit: 10 });

  const { data: invoicesData, isLoading: isInvoicesLoading } =
    useGetInvoicesQuery({ patient: patientId, limit: 10 });

  if (isError) {
    return <ErrorState message={t("patientProfile.errorNotFound")} onRetry={refetch} />;
  }

  if (isLoading || !patient) {
    return (
      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const birthYear = new Date(patient.dateOfBirth).getFullYear();
  const age = new Date().getFullYear() - birthYear;

  const tabs = [
    { id: "overview", label: t("patientProfile.tabs.overview") },
    {
      id: "appointments",
      label: t("patientProfile.tabs.appointments"),
      count: appointmentsData?.pagination?.total,
    },
    { id: "visits", label: t("patientProfile.tabs.visits"), count: visitsData?.pagination?.total },
    {
      id: "prescriptions",
      label: t("patientProfile.tabs.prescriptions"),
      count: prescriptionsData?.pagination?.total,
    },
    {
      id: "laboratory",
      label: t("patientProfile.tabs.laboratory"),
      count: labOrdersData?.pagination?.total,
    },
    {
      id: "attachments",
      label: t("patientProfile.tabs.attachments"),
      count: attachmentsData?.pagination?.total,
    },
    { id: "billing", label: t("patientProfile.tabs.billing"), count: invoicesData?.pagination?.total },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle={`${t("patientProfile.patientId")}: ${patient._id}`}
        backAction={
          <Link href="/patients">
            <Button variant="ghost" size="sm" leftIcon={<LuArrowLeft className="w-4 h-4" />}>
              {t("patientProfile.backToDirectory")}
            </Button>
          </Link>
        }
        badge={<StatusBadge status={patient.isActive ? "active" : "inactive"} size="sm" />}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/appointments">
              <Button variant="secondary" size="sm" leftIcon={<LuCalendar className="w-3.5 h-3.5" />}>
                {t("patientProfile.bookAppointment")}
              </Button>
            </Link>
            <Link href="/visits/new">
              <Button variant="primary" size="sm" leftIcon={<LuPlus className="w-3.5 h-3.5" />}>
                {t("patientProfile.startConsultation")}
              </Button>
            </Link>
          </div>
        }
      />

      {/* Medical Record Top Identity Banner */}
      <Card className="bg-surface border-border-subtle p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {/* Demographics */}
          <div className="flex items-start gap-3.5 md:border-r md:border-border-subtle/80 md:pr-4">
            <div className="w-12 h-12 rounded-full bg-mint text-teal-dark font-bold text-base flex items-center justify-center shrink-0">
              {patient.firstName[0]}
            </div>
            <div>
              <p className="text-sm font-bold text-ink leading-tight">
                {patient.firstName} {patient.lastName}
              </p>
              <p className="text-xs text-slate-muted capitalize mt-0.5">
                {patient.gender} • {t("patientProfile.ageYears", { count: age })}
              </p>
              <p className="text-[11px] text-slate-light font-mono mt-0.5">
                {t("patientProfile.dob")}: {new Date(patient.dateOfBirth).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Contact Details */}
          <div className="flex flex-col gap-1.5 text-xs text-slate-muted md:border-r md:border-border-subtle/80 md:pr-4">
            <div className="flex items-center gap-2 text-ink">
              <LuPhone className="w-3.5 h-3.5 text-teal-primary shrink-0" />
              <span className="font-mono">{patient.phone}</span>
            </div>
            <div className="flex items-center gap-2 truncate">
              <LuMail className="w-3.5 h-3.5 text-slate-light shrink-0" />
              <span className="truncate">{patient.email || t("patientProfile.noEmail")}</span>
            </div>
            <div className="flex items-center gap-2 truncate">
              <LuMapPin className="w-3.5 h-3.5 text-slate-light shrink-0" />
              <span className="truncate">
                {patient.address?.city || "Cairo"}, {patient.address?.country || "Egypt"}
              </span>
            </div>
          </div>

          {/* Clinical Flags (Blood Type, Allergies) */}
          <div className="flex flex-col gap-1.5 text-xs md:border-r md:border-border-subtle/80 md:pr-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-muted uppercase tracking-wider">
                {t("patientProfile.bloodGroup")}:
              </span>
              <span className="px-2 py-0.5 rounded-sm bg-paper text-ink font-mono font-bold text-xs border border-border-subtle">
                {patient.bloodType || t("patientProfile.unknown")}
              </span>
            </div>
            <div className="flex items-start gap-1.5 mt-1">
              <LuTriangleAlert className="w-3.5 h-3.5 text-status-warning shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-semibold text-ink">{t("patientProfile.allergies")}: </span>
                <span className="text-[11px] text-status-warning font-medium">
                  {patient.allergies?.length ? patient.allergies.join(", ") : t("patientProfile.noneReported")}
                </span>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="flex flex-col gap-1 text-xs text-slate-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-muted">
              {t("patientProfile.emergencyContact")}:
            </span>
            <p className="font-semibold text-ink leading-tight mt-0.5">
              {patient.emergencyContact?.name || t("patientProfile.notSpecified")}
            </p>
            <p className="text-[11px] text-slate-muted capitalize">
              {patient.emergencyContact?.relationship || t("patientProfile.relationshipNA")}
            </p>
            <p className="font-mono text-xs text-teal-primary">
              {patient.emergencyContact?.phone || ""}
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Panels */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card>
            <CardHeader
              title={t("patientProfile.overviewTitle")}
              subtitle={t("patientProfile.overviewSubtitle")}
            />
            <CardContent>
              {patient.chronicDiseases && patient.chronicDiseases.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {patient.chronicDiseases.map((cond, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md bg-paper border border-border-subtle text-xs font-medium text-ink flex items-center gap-1.5"
                    >
                      <LuShieldAlert className="w-3.5 h-3.5 text-teal-primary" />
                      {cond}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-muted">{t("patientProfile.noChronicConditions")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title={t("patientProfile.activityTitle")}
              subtitle={t("patientProfile.activitySubtitle")}
            />
            <CardContent className="flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-md bg-paper border border-border-subtle">
                <span className="text-slate-muted">{t("patientProfile.totalConsultations")}:</span>
                <span className="font-semibold text-ink">
                  {t("patientProfile.visitsCount", { count: visitsData?.pagination?.total ?? 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-md bg-paper border border-border-subtle">
                <span className="text-slate-muted">{t("patientProfile.totalInvoiced")}:</span>
                <span className="font-semibold text-ink">
                  {t("patientProfile.invoicesCount", { count: invoicesData?.pagination?.total ?? 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-md bg-paper border border-border-subtle">
                <span className="text-slate-muted">{t("patientProfile.registeredOn")}:</span>
                <span className="font-mono text-slate-dark">
                  {new Date(patient.createdAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "appointments" && (
        <DataTable
          columns={[
            {
              key: "date",
              header: t("patientProfile.appointmentDate"),
              render: (a) => (
                <span className="font-mono text-xs">
                  {new Date(a.appointmentDate).toLocaleString()}
                </span>
              ),
            },
            {
              key: "reason",
              header: t("patientProfile.reasonChiefComplaint"),
              render: (a) => a.reason || t("patientProfile.generalConsultation"),
            },
            {
              key: "duration",
              header: t("patientProfile.duration"),
              render: (a) => t("patientProfile.durationMinutes", { count: a.duration }),
            },
            {
              key: "status",
              header: t("patientProfile.status"),
              render: (a) => <StatusBadge status={a.status} size="sm" />,
            },
          ]}
          data={appointmentsData?.data}
          isLoading={isAptsLoading}
          emptyTitle={t("patientProfile.emptyTitleAppointments")}
          emptyDescription={t("patientProfile.emptyDescriptionAppointments")}
        />
      )}

      {activeTab === "visits" && (
        <DataTable
          columns={[
            {
              key: "date",
              header: t("patientProfile.consultationDate"),
              render: (v) => (
                <span className="font-mono text-xs">
                  {new Date(v.createdAt).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: "complaint",
              header: t("patientProfile.chiefComplaint"),
              render: (v) => v.chiefComplaint,
            },
            {
              key: "diagnosis",
              header: t("patientProfile.diagnosis"),
              render: (v) => (v.diagnosis?.length ? v.diagnosis.join(", ") : t("patientProfile.pending")),
            },
            {
              key: "followUp",
              header: t("patientProfile.followUp"),
              render: (v) =>
                v.followUpDate ? new Date(v.followUpDate).toLocaleDateString() : t("patientProfile.none"),
            },
          ]}
          data={visitsData?.data}
          isLoading={isVisitsLoading}
          emptyTitle={t("patientProfile.emptyTitleVisits")}
          emptyDescription={t("patientProfile.emptyDescriptionVisits")}
        />
      )}

      {activeTab === "prescriptions" && (
        <DataTable
          columns={[
            {
              key: "date",
              header: t("patientProfile.issuedDate"),
              render: (rx) => (
                <span className="font-mono text-xs">
                  {new Date(rx.createdAt).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: "medications",
              header: t("patientProfile.medicationsPrescribed"),
              render: (rx) => (
                <div className="flex flex-col gap-1">
                  {rx.medications.map((m, idx) => (
                    <span key={idx} className="font-medium text-xs">
                      • {m.name} ({m.dosage} - {m.frequency})
                    </span>
                  ))}
                </div>
              ),
            },
            {
              key: "instructions",
              header: t("patientProfile.generalInstructions"),
              render: (rx) => rx.generalInstructions || "-",
            },
          ]}
          data={prescriptionsData?.data}
          isLoading={isRxsLoading}
          emptyTitle={t("patientProfile.emptyTitlePrescriptions")}
          emptyDescription={t("patientProfile.emptyDescriptionPrescriptions")}
        />
      )}

      {activeTab === "laboratory" && (
        <DataTable
          columns={[
            {
              key: "orderedAt",
              header: t("patientProfile.orderedDate"),
              render: (l) => (
                <span className="font-mono text-xs">
                  {new Date(l.orderedAt).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: "tests",
              header: t("patientProfile.labTests"),
              render: (l) => l.tests.map((t) => t.name).join(", "),
            },
            {
              key: "priority",
              header: t("patientProfile.priority"),
              render: (l) => <StatusBadge status={l.priority} size="sm" />,
            },
            {
              key: "status",
              header: t("patientProfile.status"),
              render: (l) => <StatusBadge status={l.status} size="sm" />,
            },
          ]}
          data={labOrdersData?.data}
          isLoading={isLabsLoading}
          emptyTitle={t("patientProfile.emptyTitleLabOrders")}
          emptyDescription={t("patientProfile.emptyDescriptionLabOrders")}
        />
      )}

      {activeTab === "attachments" && (
        <DataTable
          columns={[
            {
              key: "title",
              header: t("patientProfile.documentTitle"),
              render: (f) => (
                <div className="flex items-center gap-2">
                  <LuPaperclip className="w-4 h-4 text-teal-primary" />
                  <span className="font-semibold text-ink">{f.title}</span>
                </div>
              ),
            },
            {
              key: "type",
              header: t("patientProfile.category"),
              render: (f) => <span className="capitalize">{f.type.replace(/_/g, " ")}</span>,
            },
            {
              key: "date",
              header: t("patientProfile.uploadDate"),
              render: (f) => new Date(f.createdAt).toLocaleDateString(),
            },
            {
              key: "file",
              header: t("patientProfile.file"),
              align: "right",
              render: (f) =>
                f.file?.url ? (
                  <a
                    href={f.file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-primary hover:underline font-medium text-xs"
                  >
                    {t("patientProfile.viewDocument")}
                  </a>
                ) : (
                  "-"
                ),
            },
          ]}
          data={attachmentsData?.data}
          isLoading={isFilesLoading}
          emptyTitle={t("patientProfile.emptyTitleAttachments")}
          emptyDescription={t("patientProfile.emptyDescriptionAttachments")}
        />
      )}

      {activeTab === "billing" && (
        <DataTable
          columns={[
            {
              key: "invoiceNumber",
              header: t("patientProfile.invoiceNumber"),
              render: (inv) => <span className="font-mono font-bold text-ink">{inv.invoiceNumber}</span>,
            },
            {
              key: "date",
              header: t("patientProfile.issuedDate"),
              render: (inv) => new Date(inv.issuedAt).toLocaleDateString(),
            },
            {
              key: "total",
              header: t("patientProfile.total"),
              render: (inv) => `$${inv.total.toFixed(2)}`,
            },
            {
              key: "paid",
              header: t("patientProfile.paid"),
              render: (inv) => `$${inv.paidAmount.toFixed(2)}`,
            },
            {
              key: "remaining",
              header: t("patientProfile.remaining"),
              render: (inv) => `$${inv.remainingAmount.toFixed(2)}`,
            },
            {
              key: "status",
              header: t("patientProfile.status"),
              render: (inv) => <StatusBadge status={inv.status} size="sm" />,
            },
          ]}
          data={invoicesData?.data}
          isLoading={isInvoicesLoading}
          emptyTitle={t("patientProfile.emptyTitleInvoices")}
          emptyDescription={t("patientProfile.emptyDescriptionInvoices")}
        />
      )}
    </div>
  );
}
