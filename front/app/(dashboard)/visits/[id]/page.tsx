"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useGetVisitByIdQuery } from "@/services/api/visitApi";
import { useGetPrescriptionsQuery, useCreatePrescriptionMutation } from "@/services/api/prescriptionApi";
import { useGetLabOrdersQuery, useCreateLabOrderMutation } from "@/services/api/labOrderApi";
import { useGetMedicalServicesQuery } from "@/services/api/medicalServiceApi";
import {
  useGetPerformedServicesQuery,
  useCreatePerformedServiceMutation,
} from "@/services/api/performedServiceApi";
import {
  useGetMedicalAttachmentsQuery,
  useCreateMedicalAttachmentMutation,
} from "@/services/api/medicalAttachmentApi";
import {
  useGetInvoicesQuery,
  useCreateInvoiceMutation,
} from "@/services/api/invoiceApi";
import { useCreatePaymentMutation } from "@/services/api/paymentApi";
import { selectUserRole } from "@/features/auth/authSelectors";
import { useAppSelector } from "@/redux/hooks";
import { hasPermission } from "@/lib/permissions";
import { extractApiError } from "@/services/api/baseQuery";
import type { MedicationRoute } from "@/types/prescription";
import type { LabOrderPriority } from "@/types/labOrder";
import type { MedicalAttachment, MedicalAttachmentType } from "@/types/medicalAttachment";
import type { PaymentMethod } from "@/types/payment";
import {
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Tabs,
  StatusBadge,
  DataTable,
  Button,
  Input,
  Select,
  Textarea,
  Modal,
  toast,
  ErrorState,
  Skeleton,
  type Column,
} from "@/components/ui";
import {
  LuArrowLeft,
  LuStethoscope,
  LuPill,
  LuFlaskConical,
  LuFileText,
  LuPaperclip,
  LuReceipt,
  LuPlus,
  LuCreditCard,
  LuPrinter,
  LuUser,
  LuCalendar,
  LuTrash2,
  LuExternalLink,
} from "react-icons/lu";

export default function VisitWorkspacePage() {
  const { t } = useTranslation();
  const params = useParams();
  const visitId = params.id as string;
  const role = useAppSelector(selectUserRole);

  const canCreatePrescription = hasPermission(role, "prescriptions.create");
  const canCreateLabOrder = hasPermission(role, "laboratory.create");
  const canManageBilling = hasPermission(role, "billing.manage");

  const [activeTab, setActiveTab] = useState("overview");

  // Fetch Visit
  const { data: visitData, isLoading, isError, refetch } = useGetVisitByIdQuery(visitId);
  const visit = visitData?.data;

  const patientId =
    typeof visit?.patient === "object" && visit.patient ? visit.patient._id : (visit?.patient as string);
  const doctorId =
    typeof visit?.doctor === "object" && visit.doctor ? visit.doctor._id : (visit?.doctor as string);

  // Fetch Clinical Encounters Child Resources
  const { data: prescriptionsData } = useGetPrescriptionsQuery(
    visitId ? { visit: visitId } : undefined,
    { skip: !visitId }
  );

  const { data: labOrdersData } = useGetLabOrdersQuery(
    visitId ? { visit: visitId } : undefined,
    { skip: !visitId }
  );

  const { data: performedServicesData } = useGetPerformedServicesQuery(
    visitId ? { visit: visitId, limit: 100 } : undefined,
    { skip: !visitId }
  );

  const { data: attachmentsData } = useGetMedicalAttachmentsQuery(
    { patient: patientId || "", visit: visitId },
    { skip: !patientId }
  );

  const { data: invoicesData } = useGetInvoicesQuery(
    visitId ? { visit: visitId, limit: 10 } : undefined,
    { skip: !visitId }
  );

  const { data: catalogServicesData } = useGetMedicalServicesQuery({ isActive: true, limit: 100 });

  // Filter child resources specific to this visit
  const visitPrescriptions = prescriptionsData?.data?.filter((p) => {
    const vId = typeof p.visit === "object" && p.visit ? p.visit._id : p.visit;
    return vId === visitId;
  }) || [];
  const visitDoctor =
    typeof visit?.doctor === "object" && visit.doctor
      ? visit.doctor
      : null;

  const visitLabOrders = labOrdersData?.data?.filter((l) => {
    const vId = typeof l.visit === "object" && l.visit ? l.visit._id : l.visit;
    return vId === visitId;
  }) || [];

  const visitPerformedServices = performedServicesData?.data?.filter((s) => {
    const vId = typeof s.visit === "object" && s.visit ? s.visit._id : s.visit;
    return vId === visitId;
  }) || [];

  const visitInvoice = invoicesData?.data?.find((i) => {
    const vId = typeof i.visit === "object" && i.visit ? i.visit._id : i.visit;
    return vId === visitId;
  });

  // Mutations
  const [createPrescription, { isLoading: isCreatingRx }] = useCreatePrescriptionMutation();
  const [createLabOrder, { isLoading: isCreatingLab }] = useCreateLabOrderMutation();
  const [createPerformedService, { isLoading: isCreatingService }] = useCreatePerformedServiceMutation();
  const [createAttachment, { isLoading: isUploadingFile }] = useCreateMedicalAttachmentMutation();
  const [createInvoice, { isLoading: isCreatingInvoice }] = useCreateInvoiceMutation();
  const [createPayment, { isLoading: isRecordingPayment }] = useCreatePaymentMutation();

  // Modals state
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [medications, setMedications] = useState<
    Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      route: MedicationRoute;
      instructions: string;
    }>
  >([
    {
      name: "",
      dosage: "",
      frequency: "Once daily",
      duration: "7 days",
      route: "oral",
      instructions: "",
    },
  ]);
  const [rxGeneralInstructions, setRxGeneralInstructions] = useState("");
  const [rxNotes, setRxNotes] = useState("");

  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [labTests, setLabTests] = useState<Array<{ name: string; code: string; instructions: string }>>([
    { name: "", code: "", instructions: "" },
  ]);
  const [labPriority, setLabPriority] = useState<LabOrderPriority>("routine");
  const [labReason, setLabReason] = useState("");
  const [labNotes, setLabNotes] = useState("");

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState("");
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [serviceDiscount, setServiceDiscount] = useState(0);
  const [serviceNotes, setServiceNotes] = useState("");

  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [attachmentTitle, setAttachmentTitle] = useState("");
  const [attachmentType, setAttachmentType] = useState<MedicalAttachmentType>("medical_report");
  const [attachmentDescription, setAttachmentDescription] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  if (isError) {
    return <ErrorState message="Could not load visit workspace." onRetry={refetch} />;
  }

  if (isLoading || !visit) {
    return (
      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const patient = typeof visit.patient === "object" && visit.patient ? visit.patient : null;
  const doctor = typeof visit.doctor === "object" && visit.doctor ? visit.doctor : null;
  const doctorUser = doctor && typeof doctor.user === "object" && doctor.user ? doctor.user : null;

  // Handlers
  const handleAddMedicationRow = () => {
    setMedications((prev) => [
      ...prev,
      {
        name: "",
        dosage: "",
        frequency: "Once daily",
        duration: "7 days",
        route: "oral",
        instructions: "",
      },
    ]);
  };

  const handleRemoveMedicationRow = (index: number) => {
    if (medications.length <= 1) return;
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMedicationChange = (index: number, field: string, val: string) => {
    setMedications((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: val } : m))
    );
  };

  const handleSubmitPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !doctorId) return;
    const validMeds = medications.filter(
      (m) => m.name.trim() && m.dosage.trim() && m.frequency.trim() && m.duration.trim()
    );
    if (validMeds.length === 0) {
      toast.error(t("prescriptions.prescriptionMustContainMedication"));
      return;
    }

    try {
      await createPrescription({
        visit: visitId,
        patient: patientId,
        doctor: doctorId,
        medications: validMeds,
        generalInstructions: rxGeneralInstructions.trim() || undefined,
        notes: rxNotes.trim() || undefined,
      }).unwrap();

      toast.success(t("visits.workspace.prescriptionSuccess"));
      setIsRxModalOpen(false);
      setMedications([
        {
          name: "",
          dosage: "",
          frequency: "Once daily",
          duration: "7 days",
          route: "oral",
          instructions: "",
        },
      ]);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("prescriptions.failedToIssue"));
    }
  };

  const handleSubmitLabOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !doctorId) return;
    const validTests = labTests.filter((t) => t.name.trim());
    if (validTests.length === 0) {
      toast.error("Please add at least one test name.");
      return;
    }

    try {
      await createLabOrder({
        visit: visitId,
        patient: patientId,
        doctor: doctorId,
        tests: validTests.map((t) => ({
          name: t.name.trim(),
          code: t.code.trim() || undefined,
          instructions: t.instructions.trim() || undefined,
        })),
        priority: labPriority,
        reason: labReason.trim() || undefined,
        notes: labNotes.trim() || undefined,
      }).unwrap();

      toast.success(t("visits.workspace.labOrderSuccess"));
      setIsLabModalOpen(false);
      setLabTests([{ name: "", code: "", instructions: "" }]);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || "Failed to create lab order.");
    }
  };

  const handleSubmitPerformedService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !doctorId || !selectedCatalogServiceId) {
      toast.error("Please select a medical service.");
      return;
    }

    try {
      await createPerformedService({
        visit: visitId,
        patient: patientId,
        doctor: doctorId,
        service: selectedCatalogServiceId,
        quantity: Number(serviceQuantity),
        discount: Number(serviceDiscount),
        notes: serviceNotes.trim() || undefined,
      }).unwrap();

      toast.success(t("visits.workspace.serviceSuccess"));
      setIsServiceModalOpen(false);
      setSelectedCatalogServiceId("");
      setServiceQuantity(1);
      setServiceDiscount(0);
      setServiceNotes("");
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || "Failed to record performed service.");
    }
  };

  const handleSubmitAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !attachmentFile || !attachmentTitle.trim()) {
      toast.error("Please fill title and choose a document file.");
      return;
    }

    const formData = new FormData();
    formData.append("patient", patientId);
    formData.append("visit", visitId);
    formData.append("type", attachmentType);
    formData.append("title", attachmentTitle.trim());
    if (attachmentDescription.trim()) {
      formData.append("description", attachmentDescription.trim());
    }
    formData.append("file", attachmentFile);

    try {
      await createAttachment(formData).unwrap();
      toast.success(t("visits.workspace.uploadSuccess"));
      setIsAttachmentModalOpen(false);
      setAttachmentTitle("");
      setAttachmentDescription("");
      setAttachmentFile(null);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || "Failed to upload document.");
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      const result = await createInvoice({
        visit: visitId,
        discount: 0,
        tax: 0,
      }).unwrap();

      toast.success(
        t("visits.workspace.invoiceGenerated", {
          total: result.data.total.toFixed(2),
        })
      );
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || "Failed to generate invoice.");
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitInvoice) return;
    if (paymentAmount <= 0) {
      toast.error("Payment amount must be greater than zero.");
      return;
    }

    try {
      await createPayment({
        invoice: visitInvoice._id,
        amount: Number(paymentAmount),
        method: paymentMethod,
        transactionReference: paymentReference.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      }).unwrap();

      toast.success(t("invoices.success.paymentRecorded"));
      setIsPaymentModalOpen(false);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("invoices.errors.paymentFailed"));
    }
  };

  // Columns Definitions
  const rxColumns: Column<(typeof visitPrescriptions)[0]>[] = [
    {
      key: "date",
      header: t("prescriptions.datePrescribed"),
      render: (r) => (
        <span className="font-mono text-xs text-ink">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "medications",
      header: t("prescriptions.medications"),
      render: (r) => (
        <div className="flex flex-col gap-1">
          {r.medications.map((m, i) => (
            <span key={i} className="text-xs text-ink font-medium">
              • {m.name} ({m.dosage} - {m.frequency}, {m.duration})
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Link href={`/prescriptions/${r._id}`}>
          <Button variant="ghost" size="sm" leftIcon={<LuPrinter className="w-3.5 h-3.5" />}>
            {t("prescriptions.printView")}
          </Button>
        </Link>
      ),
    },
  ];

  const labColumns: Column<(typeof visitLabOrders)[0]>[] = [
    {
      key: "tests",
      header: t("visits.workspace.testName"),
      render: (l) => (
        <div className="flex flex-col gap-0.5">
          {l.tests.map((t, idx) => (
            <span key={idx} className="text-xs font-semibold text-ink">
              {t.name} {t.code && `(${t.code})`}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "priority",
      header: t("visits.workspace.priority"),
      render: (l) => (
        <span className="capitalize text-xs font-medium text-slate-dark">{l.priority}</span>
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      render: (l) => <StatusBadge status={l.status} size="sm" />,
    },
  ];

  const serviceColumns: Column<(typeof visitPerformedServices)[0]>[] = [
    {
      key: "serviceName",
      header: t("visits.workspace.serviceCatalog"),
      render: (s) => (
        <div className="flex flex-col">
          <span className="text-xs font-bold text-ink">{s.serviceName}</span>
          <span className="text-[11px] font-mono text-slate-muted">{s.serviceCode}</span>
        </div>
      ),
    },
    {
      key: "quantity",
      header: t("visits.workspace.quantity"),
      render: (s) => <span className="text-xs font-mono">{s.quantity}</span>,
    },
    {
      key: "price",
      header: t("invoices.modal.rate"),
      render: (s) => <span className="text-xs font-mono">${s.price.toFixed(2)}</span>,
    },
    {
      key: "discount",
      header: t("invoices.modal.discount"),
      render: (s) => <span className="text-xs font-mono">-${s.discount.toFixed(2)}</span>,
    },
    {
      key: "total",
      header: t("invoices.modal.total"),
      render: (s) => (
        <span className="text-xs font-bold font-mono text-ink">
          ${(s.price * s.quantity - s.discount).toFixed(2)}
        </span>
      ),
    },
  ];

  const attachmentColumns: Column<MedicalAttachment>[] = [
    {
      key: "title",
      header: t("visits.workspace.documentTitle"),
      render: (a) => (
        <div className="flex flex-col">
          <span className="text-xs font-bold text-ink">{a.title}</span>
          {a.description && <span className="text-[11px] text-slate-muted">{a.description}</span>}
        </div>
      ),
    },
    {
      key: "type",
      header: t("visits.workspace.documentCategory"),
      render: (a) => (
        <span className="capitalize text-xs text-slate-dark">
          {t(`patientProfile.attachmentTypes.${a.type}`) || a.type}
        </span>
      ),
    },
    {
      key: "size",
      header: t("patientProfile.file"),
      render: (a) => (
        <span className="text-xs text-slate-muted font-mono">
          {(a.file.size / 1024).toFixed(1)} KB
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (a) => (
        <a href={a.file.url} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" leftIcon={<LuExternalLink className="w-3.5 h-3.5" />}>
            {t("patientProfile.viewDocument")}
          </Button>
        </a>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title={t("visits.workspace.title")}
        subtitle={`${t("visits.workspace.clinicalEncounter")}: ${visit._id}`}
        backAction={
          <Link href="/visits">
            <Button variant="ghost" size="sm" leftIcon={<LuArrowLeft className="w-4 h-4" />}>
              {t("visits.workspace.backToVisits")}
            </Button>
          </Link>
        }
      />

      {/* Header Context Banner */}
      <Card className="bg-surface border-border-subtle p-5 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Patient Card */}
          <div className="flex items-start gap-3 p-3 bg-paper rounded-lg border border-border-subtle">
            <div className="w-8 h-8 rounded-full bg-teal-primary/10 text-teal-primary flex items-center justify-center font-bold">
              <LuUser className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-muted block">
                {t("visits.workspace.patientDetails")}
              </span>
              <Link
                href={patient ? `/patients/${patient._id}` : "#"}
                className="font-bold text-ink hover:text-teal-primary transition-colors text-sm"
              >
                {patient ? `${patient.firstName} ${patient.lastName}` : t("common.patient")}
              </Link>
              <p className="text-[11px] text-slate-muted mt-0.5">
                {patient?.phone || t("common.notAvailable")} • Blood: {patient?.bloodType || "N/A"}
              </p>
            </div>
          </div>

          {/* Doctor Card */}
          <div className="flex items-start gap-3 p-3 bg-paper rounded-lg border border-border-subtle">
            <div className="w-8 h-8 rounded-full bg-teal-primary/10 text-teal-primary flex items-center justify-center font-bold">
              <LuStethoscope className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-muted block">
                {t("visits.workspace.consultingDoctor")}
              </span>
              <span className="font-bold text-ink text-sm block">
                {doctorUser ? `Dr. ${doctorUser.firstName} ${doctorUser.lastName}` : t("common.doctor")}
              </span>
              <p className="text-[11px] text-teal-primary font-medium mt-0.5">
                {doctor?.specialization || t("prescriptions.clinicalPractice")}
              </p>
            </div>
          </div>

          {/* Date & Reason Card */}
          <div className="flex items-start gap-3 p-3 bg-paper rounded-lg border border-border-subtle">
            <div className="w-8 h-8 rounded-full bg-teal-primary/10 text-teal-primary flex items-center justify-center font-bold">
              <LuCalendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-muted block">
                {t("visits.workspace.encounterDate")}
              </span>
              <span className="font-bold text-ink text-sm block">
                {new Date(visit.createdAt).toLocaleDateString()}
              </span>
              <p className="text-[11px] text-slate-muted truncate max-w-[140px] mt-0.5" title={visit.chiefComplaint}>
                {visit.chiefComplaint}
              </p>
            </div>
          </div>

          {/* Billing Settlement Summary */}
          <div className="flex items-start gap-3 p-3 bg-paper rounded-lg border border-border-subtle">
            <div className="w-8 h-8 rounded-full bg-teal-primary/10 text-teal-primary flex items-center justify-center font-bold">
              <LuReceipt className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-muted block">
                {t("visits.workspace.billingTitle")}
              </span>
              {visitInvoice ? (
                <div>
                  <span className="font-mono font-bold text-ink text-sm">
                    ${visitInvoice.total.toFixed(2)}
                  </span>
                  <div className="mt-1">
                    <StatusBadge status={visitInvoice.status} size="sm" />
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-slate-muted text-xs block">Unbilled</span>
                  <span className="text-xs text-slate-muted block">
                    {t("invoices.create.consultationFee")}:{" "}
                    {typeof visitDoctor?.consultationFee === "number"
                      ? `$${visitDoctor.consultationFee.toFixed(2)}`
                      : t("invoices.create.consultationUnavailable")}
                  </span>
                  {canManageBilling && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateInvoice}
                      isLoading={isCreatingInvoice}
                      className="mt-1 text-[10px] py-0.5 px-2 h-auto"
                    >
                      {t("visits.workspace.generateInvoice")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Workspace Tabs Navigation */}
      <Tabs
        tabs={[
          {
            id: "overview",
            label: t("visits.workspace.tabs.overview"),
            icon: <LuStethoscope className="w-4 h-4" />,
          },
          {
            id: "prescriptions",
            label: `${t("visits.workspace.tabs.prescriptions")} (${visitPrescriptions.length})`,
            icon: <LuPill className="w-4 h-4" />,
          },
          {
            id: "labOrders",
            label: `${t("visits.workspace.tabs.labOrders")} (${visitLabOrders.length})`,
            icon: <LuFlaskConical className="w-4 h-4" />,
          },
          {
            id: "services",
            label: `${t("visits.workspace.tabs.services")} (${visitPerformedServices.length})`,
            icon: <LuFileText className="w-4 h-4" />,
          },
          {
            id: "attachments",
            label: `${t("visits.workspace.tabs.attachments")} (${attachmentsData?.data?.length || 0})`,
            icon: <LuPaperclip className="w-4 h-4" />,
          },
          {
            id: "billing",
            label: t("visits.workspace.tabs.billing"),
            icon: <LuReceipt className="w-4 h-4" />,
          },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: OVERVIEW & CLINICAL NOTES */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">
          {/* Physiological Vitals */}
          <Card className="p-5 bg-surface border-border-subtle shadow-card">
            <CardHeader
              title={t("visits.consultation.vitalsTitle")}
              subtitle={t("visits.consultation.vitalsSubtitle")}
            />
            <CardContent>
              {visit.vitals ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs">
                  <div className="p-3 bg-paper rounded-lg border border-border-subtle">
                    <span className="text-slate-muted block text-[10px] uppercase font-semibold">
                      {t("visits.consultation.temperature")}
                    </span>
                    <span className="text-sm font-bold font-mono text-ink">
                      {visit.vitals.temperature ? `${visit.vitals.temperature} °C` : "-"}
                    </span>
                  </div>
                  <div className="p-3 bg-paper rounded-lg border border-border-subtle">
                    <span className="text-slate-muted block text-[10px] uppercase font-semibold">
                      Blood Pressure
                    </span>
                    <span className="text-sm font-bold font-mono text-ink">
                      {visit.vitals.bloodPressure
                        ? `${visit.vitals.bloodPressure.systolic}/${visit.vitals.bloodPressure.diastolic} mmHg`
                        : "-"}
                    </span>
                  </div>
                  <div className="p-3 bg-paper rounded-lg border border-border-subtle">
                    <span className="text-slate-muted block text-[10px] uppercase font-semibold">
                      {t("visits.consultation.heartRate")}
                    </span>
                    <span className="text-sm font-bold font-mono text-ink">
                      {visit.vitals.heartRate ? `${visit.vitals.heartRate} bpm` : "-"}
                    </span>
                  </div>
                  <div className="p-3 bg-paper rounded-lg border border-border-subtle">
                    <span className="text-slate-muted block text-[10px] uppercase font-semibold">
                      {t("visits.consultation.respiratoryRate")}
                    </span>
                    <span className="text-sm font-bold font-mono text-ink">
                      {visit.vitals.respiratoryRate ? `${visit.vitals.respiratoryRate} /min` : "-"}
                    </span>
                  </div>
                  <div className="p-3 bg-paper rounded-lg border border-border-subtle">
                    <span className="text-slate-muted block text-[10px] uppercase font-semibold">
                      {t("visits.consultation.oxygenSaturation")}
                    </span>
                    <span className="text-sm font-bold font-mono text-ink">
                      {visit.vitals.oxygenSaturation ? `${visit.vitals.oxygenSaturation} %` : "-"}
                    </span>
                  </div>
                  <div className="p-3 bg-paper rounded-lg border border-border-subtle">
                    <span className="text-slate-muted block text-[10px] uppercase font-semibold">
                      Weight / Height
                    </span>
                    <span className="text-sm font-bold font-mono text-ink">
                      {visit.vitals.weight ? `${visit.vitals.weight}kg` : "-"} /{" "}
                      {visit.vitals.height ? `${visit.vitals.height}cm` : "-"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-muted">No physiological vitals recorded.</p>
              )}
            </CardContent>
          </Card>

          {/* Clinical Findings & Diagnoses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-5 bg-surface border-border-subtle shadow-card">
              <CardHeader
                title={t("visits.workspace.examinationFindings")}
                subtitle="Objective physician examination notes"
              />
              <CardContent>
                <div className="p-3.5 bg-paper rounded-lg border border-border-subtle text-xs text-ink min-h-[90px] whitespace-pre-wrap leading-relaxed">
                  {visit.examination || "No examination findings entered."}
                </div>
              </CardContent>
            </Card>

            <Card className="p-5 bg-surface border-border-subtle shadow-card">
              <CardHeader
                title={t("visits.workspace.diagnosticEvaluation")}
                subtitle="Clinical diagnoses established"
              />
              <CardContent>
                <div className="p-3.5 bg-paper rounded-lg border border-border-subtle min-h-[90px] flex flex-wrap gap-2 items-start">
                  {visit.diagnosis && visit.diagnosis.length > 0 ? (
                    visit.diagnosis.map((d, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded bg-teal-primary/10 text-teal-dark font-medium text-xs border border-teal-primary/20"
                      >
                        {d}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-muted">No diagnosis entered.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Physician Notes */}
          {visit.doctorNotes && (
            <Card className="p-5 bg-surface border-border-subtle shadow-card">
              <CardHeader
                title={t("visits.workspace.doctorNotes")}
                subtitle="Treatment strategy and follow-up guidance"
              />
              <CardContent>
                <div className="p-3.5 bg-paper rounded-lg border border-border-subtle text-xs text-ink whitespace-pre-wrap leading-relaxed">
                  {visit.doctorNotes}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: PRESCRIPTIONS */}
      {activeTab === "prescriptions" && (
        <Card className="p-5 bg-surface border-border-subtle shadow-card">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <h3 className="font-bold text-ink text-sm">
                {t("visits.workspace.prescriptionsTitle")}
              </h3>
              <p className="text-xs text-slate-muted">
                {t("visits.workspace.prescriptionsSubtitle")}
              </p>
            </div>
            {canCreatePrescription && visitPrescriptions.length === 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsRxModalOpen(true)}
                leftIcon={<LuPlus className="w-3.5 h-3.5" />}
              >
                {t("visits.workspace.issuePrescription")}
              </Button>
            )}
          </div>
          <div className="pt-4">
            <DataTable
              columns={rxColumns}
              data={visitPrescriptions}
              emptyTitle={t("visits.workspace.noPrescriptions")}
              emptyDescription="No pharmaceuticals have been prescribed for this encounter."
            />
          </div>
        </Card>
      )}

      {/* TAB 3: LAB ORDERS */}
      {activeTab === "labOrders" && (
        <Card className="p-5 bg-surface border-border-subtle shadow-card">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <h3 className="font-bold text-ink text-sm">{t("visits.workspace.labOrdersTitle")}</h3>
              <p className="text-xs text-slate-muted">
                {t("visits.workspace.labOrdersSubtitle")}
              </p>
            </div>
            {canCreateLabOrder && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsLabModalOpen(true)}
                leftIcon={<LuPlus className="w-3.5 h-3.5" />}
              >
                {t("visits.workspace.orderLabTest")}
              </Button>
            )}
          </div>
          <div className="pt-4">
            <DataTable
              columns={labColumns}
              data={visitLabOrders}
              emptyTitle={t("visits.workspace.noLabOrders")}
              emptyDescription="No laboratory diagnostic investigations ordered for this encounter."
            />
          </div>
        </Card>
      )}

      {/* TAB 4: PERFORMED SERVICES */}
      {activeTab === "services" && (
        <Card className="p-5 bg-surface border-border-subtle shadow-card">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <h3 className="font-bold text-ink text-sm">{t("visits.workspace.servicesTitle")}</h3>
              <p className="text-xs text-slate-muted">
                {t("visits.workspace.servicesSubtitle")}
              </p>
            </div>
            {(role === "admin" || role === "doctor") && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsServiceModalOpen(true)}
                leftIcon={<LuPlus className="w-3.5 h-3.5" />}
              >
                {t("visits.workspace.recordService")}
              </Button>
            )}
          </div>
          <div className="pt-4">
            <DataTable
              columns={serviceColumns}
              data={visitPerformedServices}
              emptyTitle={t("visits.workspace.noServices")}
              emptyDescription="Record performed clinical procedures to bill the patient."
            />
          </div>
        </Card>
      )}

      {/* TAB 5: MEDICAL ATTACHMENTS */}
      {activeTab === "attachments" && (
        <Card className="p-5 bg-surface border-border-subtle shadow-card">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <div>
              <h3 className="font-bold text-ink text-sm">
                {t("visits.workspace.attachmentsTitle")}
              </h3>
              <p className="text-xs text-slate-muted">
                {t("visits.workspace.attachmentsSubtitle")}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAttachmentModalOpen(true)}
              leftIcon={<LuPlus className="w-3.5 h-3.5" />}
            >
              {t("visits.workspace.uploadDocument")}
            </Button>
          </div>
          <div className="pt-4">
            <DataTable
              columns={attachmentColumns}
              data={attachmentsData?.data}
              emptyTitle={t("visits.workspace.noAttachments")}
              emptyDescription="No radiology images or PDF reports uploaded for this encounter."
            />
          </div>
        </Card>
      )}

      {/* TAB 6: INVOICE & BILLING */}
      {activeTab === "billing" && (
        <Card className="p-6 bg-surface border-border-subtle shadow-card">
          {visitInvoice ? (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                <div>
                  <h3 className="font-bold text-ink text-base">
                    {t("visits.workspace.invoiceNumber")}: {visitInvoice.invoiceNumber}
                  </h3>
                  <p className="text-xs text-slate-muted">
                    Issued: {new Date(visitInvoice.issuedAt || visitInvoice.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={visitInvoice.status} size="sm" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    leftIcon={<LuPrinter className="w-3.5 h-3.5" />}
                  >
                    {t("visits.workspace.printInvoice")}
                  </Button>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="border border-border-subtle rounded-md overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-paper border-b border-border-subtle text-slate-muted font-medium">
                    <tr>
                      <th className="py-2.5 px-3">{t("invoices.modal.description")}</th>
                      <th className="py-2.5 px-2 text-right">{t("invoices.modal.qty")}</th>
                      <th className="py-2.5 px-3 text-right">{t("invoices.modal.rate")}</th>
                      <th className="py-2.5 px-3 text-right">{t("invoices.modal.total")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {visitInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium text-ink">
                          {item.type === "consultation"
                            ? t("invoices.modal.standardConsultation")
                            : `${item.serviceName} (${item.serviceCode})`}
                          {item.type !== "consultation" && item.discount > 0 && (
                            <span className="block text-[10px] font-normal text-status-success">
                              {t("invoices.modal.discount")}: -${item.discount.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-dark">{item.quantity}</td>
                        <td className="py-2 px-3 text-right text-slate-dark">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-ink">
                          ${item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Balance Summary & Payment Action */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4 bg-paper rounded-lg border border-border-subtle text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-muted">
                    {t("invoices.modal.subtotal")}: ${visitInvoice.subtotal.toFixed(2)}
                  </span>
                  {visitInvoice.discount > 0 && (
                    <span className="text-status-success">
                      {t("invoices.modal.discount")}: -${visitInvoice.discount.toFixed(2)}
                    </span>
                  )}
                  {visitInvoice.tax > 0 && (
                    <span className="text-slate-muted">
                      {t("invoices.modal.tax")}: +${visitInvoice.tax.toFixed(2)}
                    </span>
                  )}
                  <span className="font-semibold text-ink">
                    Payment Status: <span className="capitalize">{visitInvoice.status.replace("_", " ")}</span>
                  </span>
                  <span className="text-slate-muted">
                    Total Amount: ${visitInvoice.total.toFixed(2)} | Amount Paid: ${visitInvoice.paidAmount.toFixed(2)}
                  </span>
                  <span className="font-bold text-sm text-status-error">
                    Remaining Balance Due: ${visitInvoice.remainingAmount.toFixed(2)}
                  </span>
                </div>

                {canManageBilling && visitInvoice.remainingAmount > 0 && visitInvoice.status !== "cancelled" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setPaymentAmount(visitInvoice.remainingAmount);
                      setIsPaymentModalOpen(true);
                    }}
                    leftIcon={<LuCreditCard className="w-3.5 h-3.5" />}
                  >
                    {t("visits.workspace.recordPayment")}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-paper flex items-center justify-center text-slate-muted">
                <LuReceipt className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-ink text-sm">{t("visits.workspace.noInvoice")}</h4>
                <p className="text-xs text-slate-muted max-w-sm mt-1">
                  {t("visits.workspace.invoiceOptionalServices")}
                </p>
              </div>
              {canManageBilling && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateInvoice}
                  isLoading={isCreatingInvoice}
                  leftIcon={<LuPlus className="w-3.5 h-3.5" />}
                >
                  {t("visits.workspace.generateInvoice")}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {/* MODAL 1: ISSUE PRESCRIPTION */}
      <Modal
        isOpen={isRxModalOpen}
        onClose={() => setIsRxModalOpen(false)}
        title={t("visits.workspace.issuePrescription")}
        subtitle="Specify medications, dosages, frequency, and instructions"
        size="lg"
      >
        <form onSubmit={handleSubmitPrescription} className="flex flex-col gap-4 text-xs">
          {medications.map((med, idx) => (
            <div
              key={idx}
              className="p-3 bg-paper rounded-lg border border-border-subtle grid grid-cols-1 sm:grid-cols-6 gap-2 relative"
            >
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
                  {t("visits.workspace.drugName")} *
                </label>
                <Input
                  value={med.name}
                  onChange={(e) => handleMedicationChange(idx, "name", e.target.value)}
                  placeholder="e.g. Amoxicillin 500mg"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
                  {t("visits.workspace.dosage")} *
                </label>
                <Input
                  value={med.dosage}
                  onChange={(e) => handleMedicationChange(idx, "dosage", e.target.value)}
                  placeholder="1 tab"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
                  {t("visits.workspace.frequency")} *
                </label>
                <Input
                  value={med.frequency}
                  onChange={(e) => handleMedicationChange(idx, "frequency", e.target.value)}
                  placeholder="Every 8h"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
                  {t("visits.workspace.duration")} *
                </label>
                <Input
                  value={med.duration}
                  onChange={(e) => handleMedicationChange(idx, "duration", e.target.value)}
                  placeholder="7 days"
                  required
                />
              </div>

              <div className="flex items-end justify-between gap-1">
                <div className="w-full">
                  <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
                    {t("visits.workspace.route")}
                  </label>
                  <Select
                    value={med.route}
                    onChange={(e) => handleMedicationChange(idx, "route", e.target.value)}
                    options={[
                      { value: "oral", label: "Oral" },
                      { value: "topical", label: "Topical" },
                      { value: "injection", label: "Injection" },
                      { value: "inhalation", label: "Inhalation" },
                      { value: "ophthalmic", label: "Ophthalmic" },
                      { value: "nasal", label: "Nasal" },
                    ]}
                  />
                </div>
                {medications.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMedicationRow(idx)}
                    className="text-status-error mb-0.5"
                  >
                    <LuTrash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddMedicationRow}
            leftIcon={<LuPlus className="w-3.5 h-3.5" />}
            className="self-start"
          >
            {t("visits.workspace.addMedication")}
          </Button>

          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("visits.workspace.generalInstructions")}
            </label>
            <Textarea
              value={rxGeneralInstructions}
              onChange={(e) => setRxGeneralInstructions(e.target.value)}
              placeholder="e.g. Take after meals. Drink plenty of water."
              rows={2}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("visits.workspace.prescriptionNotes")}
            </label>
            <Textarea
              value={rxNotes}
              onChange={(e) => setRxNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsRxModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreatingRx}>
              {t("visits.workspace.issuePrescription")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ORDER LAB TEST */}
      <Modal
        isOpen={isLabModalOpen}
        onClose={() => setIsLabModalOpen(false)}
        title={t("visits.workspace.orderLabTest")}
        subtitle="Request clinical pathology investigations"
        size="md"
      >
        <form onSubmit={handleSubmitLabOrder} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("visits.workspace.testName")} *
            </label>
            <Input
              value={labTests[0].name}
              onChange={(e) =>
                setLabTests([{ ...labTests[0], name: e.target.value }])
              }
              placeholder="e.g. Complete Blood Count (CBC)"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
                {t("visits.workspace.testCode")}
              </label>
              <Input
                value={labTests[0].code}
                onChange={(e) =>
                  setLabTests([{ ...labTests[0], code: e.target.value }])
                }
                placeholder="e.g. CBC-01"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
                {t("visits.workspace.priority")}
              </label>
              <Select
                value={labPriority}
                onChange={(e) => setLabPriority(e.target.value as LabOrderPriority)}
                options={[
                  { value: "routine", label: "Routine" },
                  { value: "urgent", label: "Urgent" },
                  { value: "stat", label: "STAT (Emergency)" },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("visits.workspace.reason")}
            </label>
            <Textarea
              value={labReason}
              onChange={(e) => setLabReason(e.target.value)}
              placeholder="Clinical indication for test..."
              rows={2}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("visits.workspace.labOrderNotes")}
            </label>
            <Textarea
              value={labNotes}
              onChange={(e) => setLabNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsLabModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreatingLab}>
              {t("visits.workspace.orderLabTest")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: RECORD PERFORMED SERVICE */}
      <Modal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        title={t("visits.workspace.recordService")}
        subtitle="Add a procedure from the catalog to this encounter"
        size="md"
      >
        <form onSubmit={handleSubmitPerformedService} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("visits.workspace.serviceCatalog")} *
            </label>
            <Select
              value={selectedCatalogServiceId}
              onChange={(e) => setSelectedCatalogServiceId(e.target.value)}
              placeholder={t("visits.workspace.selectService")}
              options={
                catalogServicesData?.data?.map((s) => ({
                  value: s._id,
                  label: `${s.name} (${s.code}) - $${s.price.toFixed(2)}`,
                })) || []
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
                {t("visits.workspace.quantity")} *
              </label>
              <Input
                type="number"
                min={1}
                value={serviceQuantity}
                onChange={(e) => setServiceQuantity(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
                {t("visits.workspace.discount")}
              </label>
              <Input
                type="number"
                min={0}
                value={serviceDiscount}
                onChange={(e) => setServiceDiscount(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("visits.workspace.notes")}
            </label>
            <Textarea
              value={serviceNotes}
              onChange={(e) => setServiceNotes(e.target.value)}
              placeholder="Clinical execution notes..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsServiceModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreatingService}>
              {t("visits.workspace.recordService")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: UPLOAD ATTACHMENT */}
      <Modal
        isOpen={isAttachmentModalOpen}
        onClose={() => setIsAttachmentModalOpen(false)}
        title={t("visits.workspace.uploadDocument")}
        subtitle="Attach diagnostic scans, pathology reports, or referrals"
        size="md"
      >
        <form onSubmit={handleSubmitAttachment} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("visits.workspace.documentTitle")} *
            </label>
            <Input
              value={attachmentTitle}
              onChange={(e) => setAttachmentTitle(e.target.value)}
              placeholder="e.g. Chest X-Ray PA View"
              required
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("visits.workspace.documentCategory")} *
            </label>
            <Select
              value={attachmentType}
              onChange={(e) => setAttachmentType(e.target.value as MedicalAttachmentType)}
              options={[
                { value: "medical_report", label: "Medical Report" },
                { value: "xray", label: "X-Ray / Radiology" },
                { value: "lab_report", label: "Lab Report" },
                { value: "prescription", label: "Prescription" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("visits.workspace.selectFile")} *
            </label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setAttachmentFile(e.target.files[0]);
                }
              }}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAttachmentModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isUploadingFile}>
              {t("visits.workspace.uploadDocument")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: RECORD INVOICE PAYMENT */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={t("visits.workspace.recordPayment")}
        subtitle={`Invoice #${visitInvoice?.invoiceNumber} - Balance: $${visitInvoice?.remainingAmount.toFixed(2)}`}
        size="md"
      >
        <form onSubmit={handleRecordPayment} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("invoices.payment.amountLabel")} *
            </label>
            <Input
              type="number"
              step="0.01"
              min={0.01}
              max={visitInvoice?.remainingAmount || 999999}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("invoices.payment.methodLabel")} *
            </label>
            <Select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              options={[
                { value: "cash", label: "Cash" },
                { value: "card", label: "Credit/Debit Card" },
                { value: "bank_transfer", label: "Bank Transfer" },
                { value: "online", label: "Online Gateway" },
                { value: "insurance", label: "Medical Insurance" },
              ]}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("invoices.payment.referenceLabel")}
            </label>
            <Input
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. TXN-109284"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-semibold text-slate-muted block mb-1">
              {t("invoices.payment.notesLabel")}
            </label>
            <Textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Payment remarks..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsPaymentModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isRecordingPayment}>
              {t("invoices.payment.confirm")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
