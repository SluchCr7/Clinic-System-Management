"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useGetLabOrdersQuery, useUpdateLabOrderMutation } from "@/services/api/labOrderApi";
import { useCreateMedicalAttachmentMutation } from "@/services/api/medicalAttachmentApi";
import type { LabOrder, LabOrderPriority, LabOrderStatus, LabOrderType } from "@/types/labOrder";
import {
  PageHeader,
  DataTable,
  Button,
  Select,
  Input,
  Textarea,
  StatusBadge,
  Modal,
  toast,
  type Column,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import { LuCircleCheck, LuFlaskConical, LuScanLine, LuExternalLink } from "react-icons/lu";

export default function LabOrdersPage() {
  const { t } = useTranslation();
  const [queryParams, setQueryParams] = useState({
    page: 1,
    limit: 10,
    status: undefined as LabOrderStatus | undefined,
    type: undefined as LabOrderType | undefined,
    priority: undefined as LabOrderPriority | undefined,
    search: "",
  });
  const { data, isLoading, isError, refetch } = useGetLabOrdersQuery(queryParams);
  const [updateLabOrder, { isLoading: isUpdating }] = useUpdateLabOrderMutation();
  const [createAttachment] = useCreateMedicalAttachmentMutation();

  const [activeOrder, setActiveOrder] = useState<LabOrder | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<LabOrderStatus>("REQUESTED");
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [performedAt, setPerformedAt] = useState("");
  const [facility, setFacility] = useState("");
  const [resultNotes, setResultNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [resultFile, setResultFile] = useState<File | null>(null);

  const openModal = (order: LabOrder, status: LabOrderStatus = order.status) => {
    setActiveOrder(order);
    setSelectedStatus(status);
    setReceivedAt(new Date().toISOString().slice(0, 10));
    setPerformedAt("");
    setFacility("");
    setResultNotes("");
    setCancelReason("");
    setResultFile(null);
  };

  const submitUpdate = async () => {
    if (!activeOrder) return;
    try {
      let resultAttachment: string | undefined;
      if (selectedStatus === "RESULT_RECEIVED" && resultFile) {
        const patientId =
          typeof activeOrder.patient === "object" ? activeOrder.patient._id : activeOrder.patient;
        const visitId =
          typeof activeOrder.visit === "object" ? activeOrder.visit._id : activeOrder.visit;
        const formData = new FormData();
        formData.append("file", resultFile);
        formData.append("patient", patientId);
        formData.append("visit", visitId);
        formData.append("type", activeOrder.type === "IMAGING" ? "xray" : "lab_report");
        formData.append("title", `نتيجة ${activeOrder.tests.map((test) => test.name).join("، ")}`);
        formData.append("description", "نتيجة طلب تحاليل أو أشعة خارجية");
        const upload = await createAttachment(formData).unwrap();
        resultAttachment = upload.data._id;
      }

      await updateLabOrder({
        id: activeOrder._id,
        data: {
          status: selectedStatus,
          receivedAt: selectedStatus === "RESULT_RECEIVED" ? receivedAt : undefined,
          performedAt: selectedStatus === "RESULT_RECEIVED" && performedAt ? performedAt : undefined,
          externalFacilityName: selectedStatus === "RESULT_RECEIVED" ? facility || undefined : undefined,
          resultNotes: selectedStatus === "RESULT_RECEIVED" ? resultNotes || undefined : undefined,
          resultAttachment,
          statusChangeReason:
            selectedStatus === "CANCELLED"
              ? cancelReason
              : selectedStatus === "REQUESTED"
                ? "تصحيح خطأ - إعادة فتح النتيجة"
                : undefined,
        },
      }).unwrap();
      toast.success(t("labOrders.success.updated"));
      setActiveOrder(null);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("labOrders.errors.updateFailed"));
    }
  };

  const requestedCount = useMemo(
    () => (data?.data || []).filter((order) => order.status === "REQUESTED").length,
    [data]
  );

  const columns: Column<LabOrder>[] = [
    {
      key: "patient",
      header: t("common.patient"),
      render: (order) => {
        const patient = typeof order.patient === "object" ? order.patient : null;
        return <span className="font-semibold text-xs text-ink">{patient ? `${patient.firstName} ${patient.lastName}` : "-"}</span>;
      },
    },
    {
      key: "type",
      header: t("labOrders.table.type"),
      render: (order) => (
        <span className="flex items-center gap-1.5 text-xs text-ink">
          {order.type === "IMAGING" ? <LuScanLine className="w-4 h-4" /> : <LuFlaskConical className="w-4 h-4" />}
          {t(order.type === "IMAGING" ? "labOrders.type.imaging" : "labOrders.type.lab")}
        </span>
      ),
    },
    {
      key: "tests",
      header: t("labOrders.table.diagnosticTests"),
      render: (order) => (
        <div className="flex flex-col gap-1">
          {order.tests.map((test, index) => (
            <span key={`${test.name}-${index}`} className="text-xs font-medium text-ink">
              • {test.name}
            </span>
          ))}
          {order.instructions && <span className="text-[10px] text-slate-muted">{order.instructions}</span>}
        </div>
      ),
    },
    {
      key: "visit",
      header: t("labOrders.table.visit"),
      render: (order) => {
        const visitId = typeof order.visit === "object" ? order.visit._id : order.visit;
        return (
          <Link href={`/visits/${visitId}`} className="inline-flex items-center gap-1 text-xs text-teal-primary hover:underline">
            {t("labOrders.table.openVisit")}
            <LuExternalLink className="w-3 h-3" />
          </Link>
        );
      },
    },
    {
      key: "priority",
      header: t("common.priority"),
      render: (order) => <StatusBadge status={order.priority} size="sm" />,
    },
    {
      key: "status",
      header: t("labOrders.table.status"),
      render: (order) => <StatusBadge status={order.status} size="sm" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (order) => (
        <div className="flex justify-end gap-2">
          {order.status === "REQUESTED" && (
            <Button variant="secondary" size="sm" onClick={() => openModal(order, "RESULT_RECEIVED")}>
              {t("labOrders.quickResult")}
            </Button>
          )}
          {order.status !== "CANCELLED" && (
            <Button variant="ghost" size="sm" onClick={() => openModal(order)}>
              {t("labOrders.updateStatus")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("labOrders.title")}
        subtitle={t("labOrders.subtitle")}
        badge={<StatusBadge status={`${requestedCount} ${t("labOrders.requestedPending")}`} size="sm" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-surface p-3 rounded-lg border border-border-subtle">
        <Select
          value={queryParams.status || ""}
          onChange={(event) => setQueryParams((prev) => ({ ...prev, status: (event.target.value as LabOrderStatus) || undefined, page: 1 }))}
          placeholder={t("labOrders.filter.allStatuses")}
          options={[
            { value: "", label: t("labOrders.filter.allStatuses") },
            { value: "REQUESTED", label: t("labOrders.status.requested") },
            { value: "RESULT_RECEIVED", label: t("labOrders.status.resultReceived") },
            { value: "CANCELLED", label: t("labOrders.status.cancelled") },
          ]}
        />
        <Select
          value={queryParams.type || ""}
          onChange={(event) => setQueryParams((prev) => ({ ...prev, type: (event.target.value as LabOrderType) || undefined, page: 1 }))}
          placeholder={t("labOrders.filter.allTypes")}
          options={[
            { value: "", label: t("labOrders.filter.allTypes") },
            { value: "LAB", label: t("labOrders.type.lab") },
            { value: "IMAGING", label: t("labOrders.type.imaging") },
          ]}
        />
        <Select
          value={queryParams.priority || ""}
          onChange={(event) => setQueryParams((prev) => ({ ...prev, priority: (event.target.value as LabOrderPriority) || undefined, page: 1 }))}
          placeholder={t("labOrders.filter.allPriorities")}
          options={[
            { value: "", label: t("labOrders.filter.allPriorities") },
            { value: "routine", label: t("labOrders.filter.routine") },
            { value: "urgent", label: t("labOrders.filter.urgent") },
            { value: "stat", label: t("labOrders.filter.stat") },
          ]}
        />
        <Input
          value={queryParams.search}
          onChange={(event) => setQueryParams((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
          placeholder={t("labOrders.filter.searchPatient")}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle={t("labOrders.emptyTitle")}
        emptyDescription={t("labOrders.emptyDescription")}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
      />

      <Modal
        isOpen={Boolean(activeOrder)}
        onClose={() => setActiveOrder(null)}
        title={t("labOrders.modal.title")}
        subtitle={activeOrder?.tests.map((test) => test.name).join("، ")}
      >
        <form onSubmit={(event) => { event.preventDefault(); void submitUpdate(); }} className="flex flex-col gap-4">
          <Select
            label={t("labOrders.modal.status")}
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value as LabOrderStatus)}
            options={[
              { value: "REQUESTED", label: t("labOrders.status.requested") },
              { value: "RESULT_RECEIVED", label: t("labOrders.status.resultReceived") },
              { value: "CANCELLED", label: t("labOrders.status.cancelled") },
            ]}
          />

          {selectedStatus === "RESULT_RECEIVED" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label={t("labOrders.modal.receivedAt")} type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
              <Input label={t("labOrders.modal.performedAt")} type="date" value={performedAt} onChange={(event) => setPerformedAt(event.target.value)} />
              <div className="sm:col-span-2">
                <Input label={t("labOrders.modal.facility")} value={facility} onChange={(event) => setFacility(event.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Textarea label={t("labOrders.modal.notes")} value={resultNotes} onChange={(event) => setResultNotes(event.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1.5">{t("labOrders.modal.file")}</label>
                <input type="file" accept=".pdf,image/*" onChange={(event) => setResultFile(event.target.files?.[0] || null)} className="block w-full text-xs" />
              </div>
            </div>
          )}

          {selectedStatus === "CANCELLED" && (
            <Textarea
              label={t("labOrders.modal.cancelReason")}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              required
            />
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button type="button" variant="secondary" size="sm" onClick={() => setActiveOrder(null)}>{t("common.cancel")}</Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isUpdating} leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}>
              {t("labOrders.updateStatus")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
