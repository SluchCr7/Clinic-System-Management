"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetLabOrdersQuery,
  useUpdateLabOrderMutation,
} from "@/services/api/labOrderApi";
import type {
  LabOrder,
  LabOrderQueryParams,
  LabOrderStatus,
  LabOrderPriority,
} from "@/types/labOrder";
import {
  PageHeader,
  DataTable,
  Button,
  Select,
  StatusBadge,
  Modal,
  toast,
  type Column,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import { selectUserRole } from "@/features/auth/authSelectors";
import { useAppSelector } from "@/redux/hooks";
import { hasPermission } from "@/lib/permissions";
import { LuCircleCheck } from "react-icons/lu";

export default function LabOrdersPage() {
  const { t } = useTranslation();
  const role = useAppSelector(selectUserRole);
  const canManageLabOrders = hasPermission(role, "laboratory.manage");
  const [queryParams, setQueryParams] = useState<LabOrderQueryParams>({
    page: 1,
    limit: 10,
    status: undefined,
    priority: undefined,
    sortBy: "orderedAt",
    sortOrder: "desc",
  });

  const { data, isLoading, isError, refetch } = useGetLabOrdersQuery(queryParams);
  const [updateLabOrder, { isLoading: isUpdating }] = useUpdateLabOrderMutation();

  const [activeOrder, setActiveOrder] = useState<LabOrder | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<LabOrderStatus>("ordered");

  const handleOpenStatusModal = (order: LabOrder) => {
    setActiveOrder(order);
    setSelectedStatus(order.status);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;

    try {
      await updateLabOrder({
        id: activeOrder._id,
        data: { status: selectedStatus },
      }).unwrap();

      toast.success(t("labOrders.success.updated"));
      setActiveOrder(null);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("labOrders.errors.updateFailed"));
    }
  };

  const columns: Column<LabOrder>[] = [
    {
      key: "orderedAt",
      header: t("labOrders.table.orderedDate"),
      render: (l) => (
        <span className="font-mono text-xs font-semibold text-ink">
          {new Date(l.orderedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "patient",
      header: t("common.patient"),
      render: (l) => {
        const p = typeof l.patient === "object" && l.patient ? l.patient : null;
        return (
          <span className="font-semibold text-ink text-xs">
            {p ? `${p.firstName} ${p.lastName}` : t("common.patient")}
          </span>
        );
      },
    },
    {
      key: "doctor",
      header: t("labOrders.table.orderingPhysician"),
      render: (l) => {
        const doc = typeof l.doctor === "object" && l.doctor ? l.doctor : null;
        const u = doc && typeof doc.user === "object" && doc.user ? doc.user : null;
        return (
          <span className="text-xs text-slate-dark">
            {u ? `Dr. ${u.lastName}` : t("common.doctor")}
          </span>
        );
      },
    },
    {
      key: "tests",
      header: t("labOrders.table.diagnosticTests"),
      render: (l) => (
        <div className="flex flex-col gap-0.5">
          {l.tests.map((t, idx) => (
            <span key={idx} className="text-xs font-medium text-ink">
              • {t.name} {t.code && `(${t.code})`}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "priority",
      header: t("common.priority"),
      render: (l) => <StatusBadge status={l.priority} size="sm" />,
    },
    {
      key: "status",
      header: t("labOrders.table.workflowStatus"),
      render: (l) => <StatusBadge status={l.status} size="sm" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => canManageLabOrders ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleOpenStatusModal(l)}
        >
          {t("labOrders.updateStatus")}
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("labOrders.title")}
        subtitle={t("labOrders.subtitle")}
      />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-40">
            <Select
              value={queryParams.status || ""}
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  status: (e.target.value as LabOrderStatus) || undefined,
                  page: 1,
                }))
              }
              placeholder={t("labOrders.filter.allStatuses")}
              options={[
                { value: "", label: t("labOrders.filter.allStatuses") },
                { value: "ordered", label: t("labOrders.filter.ordered") },
                { value: "sample_collected", label: t("labOrders.filter.sampleCollected") },
                { value: "processing", label: t("labOrders.filter.processing") },
                { value: "completed", label: t("labOrders.filter.completed") },
                { value: "cancelled", label: t("labOrders.filter.cancelled") },
              ]}
            />
          </div>

          <div className="w-32">
            <Select
              value={queryParams.priority || ""}
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  priority: (e.target.value as LabOrderPriority) || undefined,
                  page: 1,
                }))
              }
              placeholder={t("labOrders.filter.allPriorities")}
              options={[
                { value: "", label: t("labOrders.filter.allPriorities") },
                { value: "routine", label: t("labOrders.filter.routine") },
                { value: "urgent", label: t("labOrders.filter.urgent") },
                { value: "stat", label: t("labOrders.filter.stat") },
              ]}
            />
          </div>
        </div>
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

      {/* Update Lab Status Modal */}
      <Modal
        isOpen={Boolean(activeOrder)}
        onClose={() => setActiveOrder(null)}
        title={t("labOrders.modal.title")}
        subtitle={`${t("labOrders.modal.orderId")}: ${activeOrder?._id}`}
      >
        <form onSubmit={handleUpdateStatus} className="flex flex-col gap-4">
          <Select
            label={t("labOrders.modal.workflowStatus")}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as LabOrderStatus)}
            options={[
              { value: "ordered", label: t("labOrders.filter.ordered") },
              { value: "sample_collected", label: t("labOrders.filter.sampleCollected") },
              { value: "processing", label: t("labOrders.filter.processing") },
              { value: "completed", label: t("labOrders.filter.completed") },
              { value: "cancelled", label: t("labOrders.filter.cancelled") },
            ]}
          />

          <div className="p-3 bg-paper rounded-lg text-xs text-slate-muted flex flex-col gap-1">
            <span className="font-semibold text-ink">{t("labOrders.modal.testsIncluded")}</span>
            {activeOrder?.tests.map((t, idx) => (
              <span key={idx}>• {t.name}</span>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setActiveOrder(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isUpdating}
              leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
            >
              {t("labOrders.updateStatus")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
