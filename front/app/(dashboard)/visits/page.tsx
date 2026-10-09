"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useGetVisitsQuery } from "@/services/api/visitApi";
import type { Visit, VisitQueryParams } from "@/types/visit";
import {
  PageHeader,
  DataTable,
  Button,
  type Column,
} from "@/components/ui";
import { LuPlus, LuClipboardCheck } from "react-icons/lu";

export default function VisitsPage() {
  const { t } = useTranslation();
  const [queryParams, setQueryParams] = useState<VisitQueryParams>({
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const { data, isLoading, isError, refetch } = useGetVisitsQuery(queryParams);

  const columns: Column<Visit>[] = [
    {
      key: "date",
      header: t("visits.table.date"),
      render: (v) => (
        <span className="font-mono text-xs text-ink font-semibold">
          {new Date(v.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "patient",
      header: t("common.patient"),
      render: (v) => {
        const p = typeof v.patient === "object" && v.patient ? v.patient : null;
        return (
          <Link
            href={p ? `/patients/${p._id}` : "#"}
            className="text-xs font-semibold text-ink hover:text-teal-primary transition-colors"
          >
            {p ? `${p.firstName} ${p.lastName}` : t("common.patient")}
          </Link>
        );
      },
    },
    {
      key: "doctor",
      header: t("visits.table.consultingPhysician"),
      render: (v) => {
        const doc = typeof v.doctor === "object" && v.doctor ? v.doctor : null;
        const u = doc && typeof doc.user === "object" && doc.user ? doc.user : null;
        return (
          <span className="text-xs text-slate-dark">
            {u ? `Dr. ${u.lastName}` : t("common.doctor")}
          </span>
        );
      },
    },
    {
      key: "chiefComplaint",
      header: t("visits.table.chiefComplaint"),
      render: (v) => (
        <span className="text-xs font-medium text-ink max-w-xs truncate block">
          {v.chiefComplaint}
        </span>
      ),
    },
    {
      key: "diagnosis",
      header: t("visits.table.diagnosis"),
      render: (v) => (
        <span className="text-xs text-slate-muted max-w-xs truncate block">
          {v.diagnosis?.length ? v.diagnosis.join(", ") : t("visits.table.pendingEvaluation")}
        </span>
      ),
    },
    {
      key: "vitals",
      header: t("visits.table.vitalsSummary"),
      render: (v) => {
        if (!v.vitals) return <span className="text-slate-light">-</span>;
        const bp = v.vitals.bloodPressure
          ? `${v.vitals.bloodPressure.systolic}/${v.vitals.bloodPressure.diastolic}`
          : null;
        return (
          <span className="text-[11px] font-mono text-slate-muted">
            {bp && `BP: ${bp}`} {v.vitals.heartRate && `HR: ${v.vitals.heartRate}`}
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("visits.title")}
        subtitle={t("visits.subtitle")}
        actions={
          <Link href="/visits/new">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<LuPlus className="w-3.5 h-3.5" />}
            >
              {t("visits.newConsultation")}
            </Button>
          </Link>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle={t("visits.emptyTitle")}
        emptyDescription={t("visits.emptyDescription")}
        emptyActionLabel={t("visits.startConsultation")}
        onEmptyAction={() => {}}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
      />
    </div>
  );
}
