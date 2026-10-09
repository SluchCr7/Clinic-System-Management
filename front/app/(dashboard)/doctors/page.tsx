"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useGetDoctorsQuery } from "@/services/api/doctorApi";
import type { Doctor, DoctorQueryParams } from "@/types/doctor";
import {
  PageHeader,
  DataTable,
  Button,
  SearchInput,
  Select,
  StatusBadge,
  type Column,
} from "@/components/ui";
import { LuEye, LuStethoscope } from "react-icons/lu";

export default function DoctorsPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [queryParams, setQueryParams] = useState<DoctorQueryParams>({
    page: 1,
    limit: 10,
    search: "",
    specialization: undefined,
    isActive: undefined,
  });

  const { data, isLoading, isError, refetch } = useGetDoctorsQuery(queryParams);

  const columns: Column<Doctor>[] = [
    {
      key: "doctor",
      header: t("doctors.table.doctorSpecialist"),
      render: (d) => {
        const userObj = typeof d.user === "object" && d.user ? d.user : null;
        const name = userObj
          ? `Dr. ${userObj.firstName} ${userObj.lastName}`
          : t("common.doctor");

        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-mint text-teal-dark font-bold text-xs flex items-center justify-center shrink-0">
              <LuStethoscope className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-ink leading-tight">{name}</p>
              <p className="text-[11px] text-slate-muted">{userObj?.email || ""}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "specialization",
      header: t("doctors.table.specialty"),
      render: (d) => (
        <span className="font-medium text-ink bg-paper px-2 py-0.5 rounded-sm border border-border-subtle text-xs">
          {d.specialization}
        </span>
      ),
    },
    {
      key: "licenseNumber",
      header: t("doctors.table.license"),
      render: (d) => <span className="font-mono text-slate-dark text-xs">{d.licenseNumber}</span>,
    },
    {
      key: "consultationFee",
      header: t("doctors.table.fee"),
      render: (d) => (
        <span className="font-semibold text-ink">${d.consultationFee.toFixed(2)}</span>
      ),
    },
    {
      key: "yearsOfExperience",
      header: t("doctors.table.experience"),
      render: (d) => t("doctors.table.years", { count: d.yearsOfExperience }),
    },
    {
      key: "status",
      header: t("common.status"),
      render: (d) => (
        <StatusBadge status={d.isActive ? "active" : "inactive"} size="sm" />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (d) => (
        <Link href={`/doctors/${d._id}`}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<LuEye className="w-3.5 h-3.5" />}
          >
            {t("doctors.table.profile")}
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("doctors.title")}
        subtitle={t("doctors.subtitle")}
      />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border-subtle">
        <SearchInput
          placeholder={t("doctors.searchPlaceholder")}
          value={queryParams.search}
          onDebouncedChange={(search) =>
            setQueryParams((prev) => ({ ...prev, search, page: 1 }))
          }
          className="max-w-xs"
        />

        <div className="flex items-center gap-2.5">
          <div className="w-32">
            <Select
              value={
                queryParams.isActive === undefined
                  ? ""
                  : String(queryParams.isActive)
              }
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  isActive:
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "true",
                  page: 1,
                }))
              }
              placeholder={t("doctors.allStatus")}
              options={[
                { value: "", label: t("doctors.allStatus") },
                { value: "true", label: t("common.active") },
                { value: "false", label: t("common.inactive") },
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
        emptyTitle={t("doctors.emptyTitle")}
        emptyDescription={t("doctors.emptyDescription")}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
        onRowClick={(d) => router.push(`/doctors/${d._id}`)}
      />
    </div>
  );
}
