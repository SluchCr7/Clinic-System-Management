"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetDoctorAssignmentsQuery,
  useCreateDoctorAssignmentMutation,
  useUpdateDoctorAssignmentMutation,
  useDeleteDoctorAssignmentMutation,
} from "@/services/api/doctorAssignmentApi";
import { useGetDoctorsQuery } from "@/services/api/doctorApi";
import { useGetUsersQuery } from "@/services/api/userApi";
import type {
  DoctorAssignment,
  DoctorAssignmentQueryParams,
} from "@/types/doctor";
import {
  PageHeader,
  DataTable,
  Button,
  Select,
  Input,
  Textarea,
  Modal,
  ConfirmDialog,
  StatusBadge,
  toast,
  type Column,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import { selectUserRole } from "@/features/auth/authSelectors";
import { useAppSelector } from "@/redux/hooks";
import { LuPlus, LuUserCheck, LuShieldAlert, LuPower } from "react-icons/lu";

export default function DoctorAssignmentsPage() {
  const { t } = useTranslation();
  const role = useAppSelector(selectUserRole);

  const [queryParams, setQueryParams] = useState<DoctorAssignmentQueryParams>({
    page: 1,
    limit: 10,
    isActive: undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const { data, isLoading, isError, refetch } =
    useGetDoctorAssignmentsQuery(queryParams);

  const { data: doctorsData } = useGetDoctorsQuery({
    limit: 100,
    isActive: true,
  });
  const { data: receptionistsData } = useGetUsersQuery({
    role: "receptionist",
    limit: 100,
    isActive: true,
  });

  const [createAssignment, { isLoading: isCreating }] =
    useCreateDoctorAssignmentMutation();
  const [updateAssignment, { isLoading: isUpdating }] =
    useUpdateDoctorAssignmentMutation();
  const [deleteAssignment, { isLoading: isDeleting }] =
    useDeleteDoctorAssignmentMutation();

  // Create Assignment Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    doctor: "",
    receptionist: "",
    notes: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);

  // Toggle/Deactivate Confirmation State
  const [selectedAssignment, setSelectedAssignment] =
    useState<DoctorAssignment | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  if (role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <LuShieldAlert className="w-12 h-12 text-status-error mb-3" />
        <h2 className="text-lg font-semibold text-ink">
          {t("doctorAssignments.accessDenied.title")}
        </h2>
        <p className="text-sm text-slate-muted mt-1">
          {t("doctorAssignments.accessDenied.message")}
        </p>
      </div>
    );
  }

  const handleOpenCreateModal = () => {
    setCreateForm({
      doctor: doctorsData?.data?.[0]?._id || "",
      receptionist: receptionistsData?.data?.[0]?._id || "",
      notes: "",
    });
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.doctor || !createForm.receptionist) {
      setCreateError(t("doctorAssignments.messages.selectBoth"));
      return;
    }

    try {
      await createAssignment({
        doctor: createForm.doctor,
        receptionist: createForm.receptionist,
        notes: createForm.notes.trim() || undefined,
      }).unwrap();

      toast.success(t("doctorAssignments.messages.createSuccess"));
      setIsCreateModalOpen(false);
    } catch (err) {
      const extracted = extractApiError(err);
      const message =
        extracted.message || t("doctorAssignments.messages.createFailed");
      setCreateError(message);
      toast.error(message);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedAssignment) return;

    try {
      if (selectedAssignment.isActive) {
        await deleteAssignment(selectedAssignment._id).unwrap();
        toast.success(t("doctorAssignments.messages.deactivateSuccess"));
      } else {
        await updateAssignment({
          id: selectedAssignment._id,
          data: { isActive: true },
        }).unwrap();
        toast.success(t("doctorAssignments.messages.activateSuccess"));
      }
      setIsConfirmDialogOpen(false);
      setSelectedAssignment(null);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(
        extracted.message || t("doctorAssignments.messages.statusUpdateFailed")
      );
    }
  };

  const columns: Column<DoctorAssignment>[] = [
    {
      key: "doctor",
      header: t("doctorAssignments.columns.doctor"),
      render: (a) => {
        const doc = typeof a.doctor === "object" ? a.doctor : null;
        const u = doc && typeof doc.user === "object" ? doc.user : null;
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-teal-subtle text-teal-dark font-semibold text-xs flex items-center justify-center shrink-0">
              {t("doctorAssignments.table.doctorAvatar")}
            </div>
            <div>
              <p className="font-semibold text-ink leading-tight">
                {u
                  ? t("doctorAssignments.table.doctorName", {
                      firstName: u.firstName,
                      lastName: u.lastName,
                    })
                  : t("doctorAssignments.table.doctorFallback")}
              </p>
              <p className="text-[11px] text-teal-dark font-medium">
                {doc?.specialization ||
                  t("doctorAssignments.table.generalPractice")}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "receptionist",
      header: t("doctorAssignments.columns.receptionist"),
      render: (a) => {
        const rec = typeof a.receptionist === "object" ? a.receptionist : null;
        return (
          <div>
            <p className="font-medium text-ink leading-tight">
              {rec
                ? `${rec.firstName} ${rec.lastName}`
                : t("doctorAssignments.table.receptionistFallback")}
            </p>
            <p className="text-[11px] text-slate-muted">{rec?.email || "-"}</p>
          </div>
        );
      },
    },
    {
      key: "assignedBy",
      header: t("doctorAssignments.columns.assignedBy"),
      render: (a) => {
        const by = typeof a.assignedBy === "object" ? a.assignedBy : null;
        return (
          <span className="text-xs text-slate-dark">
            {by
              ? `${by.firstName} ${by.lastName}`
              : t("doctorAssignments.table.adminFallback")}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("doctorAssignments.columns.status"),
      render: (a) => (
        <StatusBadge status={a.isActive ? "active" : "inactive"} size="sm" />
      ),
    },
    {
      key: "notes",
      header: t("doctorAssignments.columns.notes"),
      render: (a) => (
        <span className="text-xs text-slate-muted truncate max-w-[180px] block">
          {a.notes || "-"}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("doctorAssignments.columns.actions"),
      align: "right",
      render: (a) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedAssignment(a);
            setIsConfirmDialogOpen(true);
          }}
          leftIcon={<LuPower className="w-3.5 h-3.5" />}
        >
          {a.isActive
            ? t("doctorAssignments.actions.deactivate")
            : t("doctorAssignments.actions.activate")}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("doctorAssignments.page.title")}
        subtitle={t("doctorAssignments.page.subtitle")}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            leftIcon={<LuPlus className="w-3.5 h-3.5" />}
          >
            {t("doctorAssignments.page.assignButton")}
          </Button>
        }
      />

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={
            queryParams.isActive === undefined
              ? ""
              : queryParams.isActive
              ? "true"
              : "false"
          }
          onChange={(e) =>
            setQueryParams({
              ...queryParams,
              page: 1,
              isActive:
                e.target.value === "" ? undefined : e.target.value === "true",
            })
          }
          options={[
            { value: "", label: t("doctorAssignments.filters.allStatuses") },
            {
              value: "true",
              label: t("doctorAssignments.filters.activeOnly"),
            },
            {
              value: "false",
              label: t("doctorAssignments.filters.inactiveOnly"),
            },
          ]}
          className="w-48"
        />
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        isError={isError}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams({ ...queryParams, page })}
        emptyTitle={t("doctorAssignments.table.emptyTitle")}
        emptyDescription={t("doctorAssignments.table.emptyDescription")}
      />

      {/* Create Assignment Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t("doctorAssignments.createModal.title")}
        subtitle={t("doctorAssignments.createModal.subtitle")}
      >
        <form onSubmit={handleCreateAssignment} className="flex flex-col gap-4">
          {createError && (
            <div className="p-3 rounded-lg bg-status-error-bg border border-status-error/20 text-xs text-status-error leading-relaxed">
              {createError}
            </div>
          )}

          <Select
            label={t("doctorAssignments.createModal.doctorLabel")}
            required
            value={createForm.doctor}
            onChange={(e) =>
              setCreateForm({ ...createForm, doctor: e.target.value })
            }
            options={[
              {
                value: "",
                label: t("doctorAssignments.createModal.doctorPlaceholder"),
              },
              ...(doctorsData?.data?.map((d) => {
                const u = typeof d.user === "object" ? d.user : null;
                return {
                  value: d._id,
                  label: u
                    ? t("doctorAssignments.createModal.doctorOption", {
                        firstName: u.firstName,
                        lastName: u.lastName,
                        specialization: d.specialization,
                      })
                    : d.specialization,
                };
              }) || []),
            ]}
          />

          <Select
            label={t("doctorAssignments.createModal.receptionistLabel")}
            required
            value={createForm.receptionist}
            onChange={(e) =>
              setCreateForm({ ...createForm, receptionist: e.target.value })
            }
            options={[
              {
                value: "",
                label: t(
                  "doctorAssignments.createModal.receptionistPlaceholder"
                ),
              },
              ...(receptionistsData?.data?.map((r) => ({
                value: r._id,
                label: t("doctorAssignments.createModal.receptionistOption", {
                  firstName: r.firstName,
                  lastName: r.lastName,
                  email: r.email,
                }),
              })) || []),
            ]}
          />

          <Textarea
            label={t("doctorAssignments.createModal.notesLabel")}
            placeholder={t("doctorAssignments.createModal.notesPlaceholder")}
            value={createForm.notes}
            onChange={(e) =>
              setCreateForm({ ...createForm, notes: e.target.value })
            }
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              {t("doctorAssignments.actions.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreating}
              leftIcon={<LuUserCheck className="w-3.5 h-3.5" />}
            >
              {t("doctorAssignments.createModal.confirm")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => {
          setIsConfirmDialogOpen(false);
          setSelectedAssignment(null);
        }}
        onConfirm={handleToggleStatus}
        isLoading={isUpdating || isDeleting}
        title={
          selectedAssignment?.isActive
            ? t("doctorAssignments.confirmDialog.deactivateTitle")
            : t("doctorAssignments.confirmDialog.activateTitle")
        }
        message={
          selectedAssignment?.isActive
            ? t("doctorAssignments.confirmDialog.deactivateMessage")
            : t("doctorAssignments.confirmDialog.activateMessage")
        }
        confirmText={
          selectedAssignment?.isActive
            ? t("doctorAssignments.actions.deactivate")
            : t("doctorAssignments.actions.activate")
        }
        variant={selectedAssignment?.isActive ? "danger" : "primary"}
      />
    </div>
  );
}