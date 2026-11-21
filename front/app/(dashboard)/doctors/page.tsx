"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  useCreateDoctorMutation,
  useGetDoctorsQuery,
} from "@/services/api/doctorApi";
import { useCreateUserMutation } from "@/services/api/userApi";
import type {
  CreateDoctorRequest,
  Doctor,
  DoctorQueryParams,
} from "@/types/doctor";
import { selectUserRole } from "@/features/auth/authSelectors";
import { useAppSelector } from "@/redux/hooks";
import { hasPermission } from "@/lib/permissions";
import { extractApiError } from "@/services/api/baseQuery";
import {
  PageHeader,
  DataTable,
  Button,
  SearchInput,
  Select,
  StatusBadge,
  Input,
  Textarea,
  Modal,
  toast,
  type Column,
} from "@/components/ui";
import { LuCircleCheck, LuEye, LuPlus, LuStethoscope } from "react-icons/lu";

type CreateDoctorForm = Omit<CreateDoctorRequest, "user"> & {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
};

const emptyCreateForm = (): CreateDoctorForm => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  specialization: "",
  licenseNumber: "",
  consultationFee: 0,
  yearsOfExperience: 0,
  bio: "",
});

export default function DoctorsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const role = useAppSelector(selectUserRole);
  const canManageDoctors = hasPermission(role, "doctors.manage");

  const [queryParams, setQueryParams] = useState<DoctorQueryParams>({
    page: 1,
    limit: 10,
    search: "",
    specialization: undefined,
    isActive: undefined,
  });

  const { data, isLoading, isError, refetch } = useGetDoctorsQuery(queryParams);
  const [createUser, { isLoading: isCreatingUser }] = useCreateUserMutation();
  const [createDoctor, { isLoading: isCreatingDoctor }] =
    useCreateDoctorMutation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdDoctorUserId, setCreatedDoctorUserId] = useState<string | null>(
    null
  );
  const [createForm, setCreateForm] =
    useState<CreateDoctorForm>(emptyCreateForm);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let userId = createdDoctorUserId;
    if (!userId) {
      try {
        const userResponse = await createUser({
          firstName: createForm.firstName.trim(),
          lastName: createForm.lastName.trim(),
          email: createForm.email.trim().toLowerCase(),
          phone: createForm.phone.trim(),
          password: createForm.password,
          role: "doctor",
        }).unwrap();
        userId = userResponse.data._id;
        setCreatedDoctorUserId(userId);
      } catch (err) {
        const extracted = extractApiError(err);
        toast.error(extracted.message || t("doctors.errors.createFailed"));
        return;
      }
    }

    try {
      await createDoctor({
        user: userId,
        specialization: createForm.specialization.trim(),
        licenseNumber: createForm.licenseNumber.trim(),
        consultationFee: Number(createForm.consultationFee),
        yearsOfExperience: Number(createForm.yearsOfExperience),
        bio: createForm.bio?.trim() || undefined,
      }).unwrap();

      toast.success(t("doctors.success.created"));
      setIsCreateOpen(false);
      setCreatedDoctorUserId(null);
      setCreateForm(emptyCreateForm());
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(
        t("doctors.errors.profileAfterAccountFailed", {
          message: extracted.message || t("doctors.errors.createFailed"),
        })
      );
    }
  };

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
      key: "clinic",
      header: t("settings.clinicTab", "Clinic"),
      render: (d) =>
        d.clinic && typeof d.clinic === "object" ? (
          <span className="text-xs font-medium text-ink">{d.clinic.name}</span>
        ) : (
          <span className="text-xs text-slate-muted">-</span>
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
        actions={canManageDoctors ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<LuPlus className="w-4 h-4" />}
          >
            {t("doctors.addDoctor")}
          </Button>
        ) : undefined}
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

      <Modal
        isOpen={canManageDoctors && isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t("doctors.create.title")}
        subtitle={t("doctors.create.subtitle")}
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          {createdDoctorUserId && (
            <p className="rounded-md border border-status-warning/30 bg-status-warning-bg p-3 text-xs text-slate-dark">
              {t("doctors.create.accountCreatedNotice")}
            </p>
          )}

          <fieldset
            disabled={Boolean(createdDoctorUserId)}
            className="flex flex-col gap-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("doctors.create.firstName")}
                value={createForm.firstName}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    firstName: e.target.value,
                  }))
                }
                required
              />
              <Input
                label={t("doctors.create.lastName")}
                value={createForm.lastName}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    lastName: e.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("doctors.create.email")}
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
              <Input
                label={t("doctors.create.phone")}
                value={createForm.phone}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, phone: e.target.value }))
                }
                required
              />
            </div>

            <Input
              label={t("doctors.create.password")}
              type="password"
              value={createForm.password}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, password: e.target.value }))
              }
              required
            />
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("doctors.create.specialization")}
              value={createForm.specialization}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  specialization: e.target.value,
                }))
              }
              required
            />
            <Input
              label={t("doctors.create.licenseNumber")}
              value={createForm.licenseNumber}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  licenseNumber: e.target.value,
                }))
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("doctors.create.consultationFee")}
              type="number"
              min="0"
              step="0.01"
              value={createForm.consultationFee}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  consultationFee: Number(e.target.value),
                }))
              }
              required
            />
            <Input
              label={t("doctors.create.yearsOfExperience")}
              type="number"
              min="0"
              max="70"
              step="1"
              value={createForm.yearsOfExperience}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  yearsOfExperience: Number(e.target.value),
                }))
              }
              required
            />
          </div>

          <Textarea
            label={t("doctors.create.bio")}
            value={createForm.bio || ""}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, bio: e.target.value }))
            }
            rows={3}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreatingUser || isCreatingDoctor}
              leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
            >
              {t("doctors.create.submit")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
