"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useGetPatientsQuery } from "@/services/api/patientApi";
import type { Patient, PatientQueryParams, BloodType, Gender } from "@/types/patient";
import {
  PageHeader,
  DataTable,
  Button,
  SearchInput,
  Select,
  StatusBadge,
  type Column,
} from "@/components/ui";
import { LuPlus, LuEye } from "react-icons/lu";
import { selectUserRole } from "@/features/auth/authSelectors";
import { useAppSelector } from "@/redux/hooks";
import { hasPermission } from "@/lib/permissions";

export default function PatientsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = useAppSelector(selectUserRole);
  const canCreatePatient = hasPermission(role, "patients.create");

  const [queryParams, setQueryParams] = useState<PatientQueryParams>({
    page: 1,
    limit: 10,
    search: "",
    gender: undefined,
    bloodType: undefined,
    isActive: undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const { data, isLoading, isError, refetch } = useGetPatientsQuery(queryParams);

  const columns: Column<Patient>[] = [
    {
      key: "patient",
      header: t("patients.patient"),
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-mint text-teal-dark font-semibold text-xs flex items-center justify-center shrink-0">
            {p.firstName[0]}
          </div>
          <div>
            <p className="font-semibold text-ink leading-tight">
              {p.firstName} {p.lastName}
            </p>
            <p className="text-[11px] text-slate-muted">{p.email || t("patients.noEmail")}</p>
          </div>
        </div>
      ),
    },
    {
      key: "gender",
      header: t("patients.genderAge"),
      render: (p) => {
        const birthYear = new Date(p.dateOfBirth).getFullYear();
        const age = new Date().getFullYear() - birthYear;
        return (
          <span className="capitalize text-slate-dark">
            {t(`patients.genderOptions.${p.gender}`, { defaultValue: p.gender })}, {t("patients.ageYears", { count: age })}
          </span>
        );
      },
    },
    {
      key: "phone",
      header: t("patients.phoneContact"),
      render: (p) => <span className="font-mono text-slate-dark">{p.phone}</span>,
    },
    {
      key: "bloodType",
      header: t("patients.bloodType"),
      render: (p) =>
        p.bloodType ? (
          <span className="px-2 py-0.5 rounded-sm bg-paper font-mono text-[11px] font-semibold text-ink border border-border-subtle">
            {p.bloodType}
          </span>
        ) : (
          <span className="text-slate-light">-</span>
        ),
    },
    {
      key: "allergies",
      header: t("patients.allergies"),
      render: (p) =>
        p.allergies && p.allergies.length > 0 ? (
          <span className="text-status-warning font-medium text-[11px]">
            {p.allergies.slice(0, 2).join(", ")}
            {p.allergies.length > 2 && ` +${p.allergies.length - 2}`}
          </span>
        ) : (
          <span className="text-slate-light">{t("patients.none")}</span>
        ),
    },
    {
      key: "status",
      header: t("patients.status"),
      render: (p) => (
        <StatusBadge status={p.isActive ? "active" : "inactive"} size="sm" />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <Link href={`/patients/${p._id}`}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<LuEye className="w-3.5 h-3.5" />}
          >
            {t("patients.record")}
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("patients.title")}
        subtitle={t("patients.subtitle")}
        actions={canCreatePatient ? (
          <Link href="/patients/new">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<LuPlus className="w-3.5 h-3.5" />}
            >
              {t("patients.register")}
            </Button>
          </Link>
        ) : undefined}
      />

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border-subtle">
        <SearchInput
          placeholder={t("patients.searchPlaceholder")}
          value={queryParams.search}
          onDebouncedChange={(search) =>
            setQueryParams((prev) => ({ ...prev, search, page: 1 }))
          }
          className="max-w-xs"
        />

        <div className="flex items-center flex-wrap gap-2.5">
          <div className="w-28">
            <Select
              value={queryParams.gender || ""}
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  gender: (e.target.value as Gender) || undefined,
                  page: 1,
                }))
              }
              placeholder={t("patients.allGenders")}
              options={[
                { value: "", label: t("patients.allGenders") },
                { value: "male", label: t("patients.male") },
                { value: "female", label: t("patients.female") },
              ]}
            />
          </div>

          <div className="w-32">
            <Select
              value={queryParams.bloodType || ""}
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  bloodType: (e.target.value as BloodType) || undefined,
                  page: 1,
                }))
              }
              placeholder={t("patients.bloodType")}
              options={[
                { value: "", label: t("patients.allTypes") },
                { value: "A+", label: "A+" },
                { value: "A-", label: "A-" },
                { value: "B+", label: "B+" },
                { value: "B-", label: "B-" },
                { value: "AB+", label: "AB+" },
                { value: "AB-", label: "AB-" },
                { value: "O+", label: "O+" },
                { value: "O-", label: "O-" },
              ]}
            />
          </div>

          <div className="w-28">
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
              placeholder={t("patients.allStatus")}
              options={[
                { value: "", label: t("patients.allStatus") },
                { value: "true", label: t("patients.active") },
                { value: "false", label: t("patients.inactive") },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Main Patients Table */}
      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle={t("patients.noPatients")}
        emptyDescription={t("patients.noPatientsDescription")}
        emptyActionLabel={t("patients.register")}
        onEmptyAction={() => router.push("/patients/new")}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
        onRowClick={(p) => router.push(`/patients/${p._id}`)}
      />
    </div>
  );
}
