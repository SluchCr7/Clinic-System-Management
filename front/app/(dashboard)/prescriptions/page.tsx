"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useGetPrescriptionsQuery } from "@/services/api/prescriptionApi";
import type { Prescription, PrescriptionQueryParams } from "@/types/prescription";
import {
  PageHeader,
  DataTable,
  Button,
  type Column,
} from "@/components/ui";
import { LuPrinter } from "react-icons/lu";

export default function PrescriptionsPage() {
  const { t } = useTranslation();
  const [queryParams, setQueryParams] = useState<PrescriptionQueryParams>({
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const { data, isLoading, isError, refetch } = useGetPrescriptionsQuery(queryParams);

  const columns: Column<Prescription>[] = [
    {
      key: "date",
      header: t("prescriptions.datePrescribed"),
      render: (rx) => (
        <span className="font-mono text-xs font-semibold text-ink">
          {new Date(rx.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "patient",
      header: t("prescriptions.patient"),
      render: (rx) => {
        const p = typeof rx.patient === "object" && rx.patient ? rx.patient : null;
        return (
          <span className="font-semibold text-ink text-xs">
            {p ? `${p.firstName} ${p.lastName}` : t("prescriptions.patient")}
          </span>
        );
      },
    },
    {
      key: "doctor",
      header: t("prescriptions.prescribingPhysician"),
      render: (rx) => {
        const doc = typeof rx.doctor === "object" && rx.doctor ? rx.doctor : null;
        const u = doc && typeof doc.user === "object" && doc.user ? doc.user : null;
        return (
          <span className="text-xs text-slate-dark">
            {u ? `Dr. ${u.lastName}` : t("prescriptions.physician")}
          </span>
        );
      },
    },
    {
      key: "medications",
      header: t("prescriptions.medications"),
      render: (rx) => (
        <div className="flex flex-col gap-0.5">
          {rx.medications.map((m, idx) => (
            <span key={idx} className="text-xs text-slate-muted">
              {m.name} ({m.dosage} - {m.frequency})
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (rx) => (
        <Link href={`/prescriptions/${rx._id}`}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<LuPrinter className="w-3.5 h-3.5" />}
          >
            {t("prescriptions.printView")}
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("prescriptions.title")}
        subtitle={t("prescriptions.subtitle")}
      />

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle={t("prescriptions.emptyTitle")}
        emptyDescription={t("prescriptions.emptyDescription")}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
      />
    </div>
  );
}
