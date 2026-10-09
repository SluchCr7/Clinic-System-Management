"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGetAuditLogsQuery } from "@/services/api/auditLogApi";
import type { AuditLog, AuditLogQueryParams } from "@/types/auditLog";
import {
  PageHeader,
  DataTable,
  Button,
  Select,
  Badge,
  Modal,
  type Column,
} from "@/components/ui";
import {
  LuScrollText,
  LuEye,
  LuShieldAlert,
  LuTerminal,
} from "react-icons/lu";

export default function AuditLogsPage() {
  const { t } = useTranslation();
  const [queryParams, setQueryParams] = useState<AuditLogQueryParams>({
    page: 1,
    limit: 15,
    action: undefined,
    resource: undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const { data, isLoading, isError, refetch } = useGetAuditLogsQuery(queryParams);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("CREATE") || act.includes("REGISTER") || act.includes("POST")) {
      return <Badge variant="success" size="sm">{action}</Badge>;
    }
    if (act.includes("UPDATE") || act.includes("PATCH") || act.includes("PUT")) {
      return <Badge variant="teal" size="sm">{action}</Badge>;
    }
    if (act.includes("DELETE") || act.includes("CANCEL") || act.includes("DEACTIVATE")) {
      return <Badge variant="error" size="sm">{action}</Badge>;
    }
    if (act.includes("LOGIN") || act.includes("AUTH")) {
      return <Badge variant="info" size="sm">{action}</Badge>;
    }
    return <Badge variant="neutral" size="sm">{action}</Badge>;
  };

  const columns: Column<AuditLog>[] = [
    {
      key: "createdAt",
      header: t("auditLogs.timestamp"),
      render: (log) => (
        <span className="font-mono text-xs text-ink">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "actor",
      header: t("auditLogs.actor"),
      render: (log) => {
        const u = typeof log.actor === "object" && log.actor ? log.actor : null;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-ink text-xs">
              {u ? `${u.firstName} ${u.lastName}` : (typeof log.actor === "string" ? log.actor : "System")}
            </span>
            {u?.email && (
              <span className="text-[11px] text-slate-muted">{u.email}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "action",
      header: t("auditLogs.action"),
      render: (log) => getActionBadge(log.action),
    },
    {
      key: "resource",
      header: t("auditLogs.resource"),
      render: (log) => (
        <span className="font-mono text-xs font-medium text-teal-dark">
          {log.resource}
        </span>
      ),
    },
    {
      key: "resourceId",
      header: t("auditLogs.resourceId"),
      render: (log) => (
        <span className="font-mono text-xs text-slate-muted">
          {log.resourceId ? log.resourceId.slice(-8) : "—"}
        </span>
      ),
    },
    {
      key: "ipAddress",
      header: t("auditLogs.clientIp"),
      render: (log) => (
        <span className="font-mono text-[11px] text-slate-dark">
          {log.ipAddress || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (log) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedLog(log)}
          title={t("auditLogs.viewDetails")}
        >
          <LuEye className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("auditLogs.title")}
        subtitle={t("auditLogs.subtitle")}
      />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-44">
            <Select
              value={queryParams.resource || ""}
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  resource: e.target.value || undefined,
                  page: 1,
                }))
              }
              placeholder={t("auditLogs.allResources")}
              options={[
                { value: "", label: t("auditLogs.allResources") },
                { value: "Patient", label: t("auditLogs.resourcePatient") },
                { value: "Appointment", label: t("auditLogs.resourceAppointment") },
                { value: "Visit", label: t("auditLogs.resourceVisit") },
                { value: "Prescription", label: t("auditLogs.resourcePrescription") },
                { value: "Invoice", label: t("auditLogs.resourceInvoice") },
                { value: "Payment", label: t("auditLogs.resourcePayment") },
                { value: "User", label: t("auditLogs.resourceUser") },
              ]}
            />
          </div>
        </div>

        <div className="text-xs text-slate-muted">
          {t("auditLogs.loggedEvents")}: <strong className="text-ink">{data?.pagination?.total || 0}</strong>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle={t("auditLogs.emptyTitle")}
        emptyDescription={t("auditLogs.emptyDescription")}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
      />

      {/* Audit Log Payload Details Modal */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={t("auditLogs.modalTitle")}
        subtitle={t("auditLogs.modalSubtitle", { id: selectedLog?._id ?? "" })}
        size="lg"
      >
        {selectedLog && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-paper rounded-lg">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-muted">{t("auditLogs.fieldAction")}:</span>
                <div className="mt-0.5">{getActionBadge(selectedLog.action)}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-muted">{t("auditLogs.fieldResourceTarget")}:</span>
                <p className="font-mono font-bold text-ink mt-0.5">{selectedLog.resource}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-muted">{t("auditLogs.fieldTimestamp")}:</span>
                <p className="font-mono text-ink mt-0.5">{new Date(selectedLog.createdAt).toUTCString()}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-muted">{t("auditLogs.fieldEntityId")}:</span>
                <p className="font-mono text-ink mt-0.5">{selectedLog.resourceId || "N/A"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] uppercase font-semibold text-slate-muted">{t("auditLogs.fieldAgent")}</span>
                <p className="font-mono text-[11px] text-slate-muted mt-0.5">
                  {t("auditLogs.ipPrefix")} {selectedLog.ipAddress || t("auditLogs.unknown")} • {selectedLog.userAgent || t("auditLogs.unknownClient")}
                </p>
              </div>
            </div>

            <div>
              <span className="font-semibold text-ink uppercase tracking-wider text-[11px] flex items-center gap-1.5 mb-1.5">
                <LuTerminal className="w-3.5 h-3.5 text-teal-primary" />
                {t("auditLogs.payloadTitle")}
              </span>
              <pre className="p-3 bg-surface-secondary text-ink border border-border-subtle font-mono rounded-lg overflow-x-auto text-[11px] max-h-64 leading-relaxed">
                {selectedLog.details
                  ? JSON.stringify(selectedLog.details, null, 2)
                  : t("auditLogs.payloadEmpty")}
              </pre>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-border-subtle">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedLog(null)}
              >
                {t("common.close")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
