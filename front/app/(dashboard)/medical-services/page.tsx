"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetMedicalServicesQuery,
  useCreateMedicalServiceMutation,
  useUpdateMedicalServiceMutation,
  useDeactivateMedicalServiceMutation,
} from "@/services/api/medicalServiceApi";
import type {
  MedicalService,
  MedicalServiceQueryParams,
  CreateMedicalServiceRequest,
} from "@/types/medicalService";
import {
  PageHeader,
  DataTable,
  Button,
  Select,
  Input,
  Textarea,
  Badge,
  Modal,
  toast,
  type Column,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import { selectUserRole } from "@/features/auth/authSelectors";
import { useAppSelector } from "@/redux/hooks";
import { hasPermission } from "@/lib/permissions";
import {
  LuPlus,
  LuPencil,
  LuTrash2,
  LuCircleCheck,
  LuClock,
} from "react-icons/lu";

export default function MedicalServicesPage() {
  const { t } = useTranslation();
  const role = useAppSelector(selectUserRole);
  const canManageServices = hasPermission(role, "medicalServices.manage");
  const [queryParams, setQueryParams] = useState<MedicalServiceQueryParams>({
    page: 1,
    limit: 10,
    search: "",
    category: undefined,
    isActive: undefined,
  });

  const { data, isLoading, isError, refetch } = useGetMedicalServicesQuery(queryParams);
  const [createMedicalService, { isLoading: isCreating }] = useCreateMedicalServiceMutation();
  const [updateMedicalService, { isLoading: isUpdating }] = useUpdateMedicalServiceMutation();
  const [deactivateMedicalService, { isLoading: isDeactivating }] = useDeactivateMedicalServiceMutation();

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateMedicalServiceRequest>({
    name: "",
    code: "",
    category: "Consultation",
    price: 50,
    duration: 15,
    description: "",
  });

  // Edit Modal State
  const [editingService, setEditingService] = useState<MedicalService | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    category: string;
    price: number;
    duration: number;
    description: string;
    isActive: boolean;
  }>({
    name: "",
    category: "",
    price: 0,
    duration: 15,
    description: "",
    isActive: true,
  });

  // Deactivate Modal State
  const [deactivateTarget, setDeactivateTarget] = useState<MedicalService | null>(null);

  const handleOpenEdit = (svc: MedicalService) => {
    setEditingService(svc);
    setEditForm({
      name: svc.name,
      category: svc.category,
      price: svc.price,
      duration: svc.duration,
      description: svc.description || "",
      isActive: svc.isActive,
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.code.trim()) {
      toast.error(t("medicalServices.errors.required"));
      return;
    }

    try {
      await createMedicalService({
        ...createForm,
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        price: Number(createForm.price),
        duration: Number(createForm.duration),
        description: createForm.description?.trim() || undefined,
      }).unwrap();

      toast.success(t("medicalServices.success.created"));
      setIsCreateOpen(false);
      setCreateForm({
        name: "",
        code: "",
        category: "Consultation",
        price: 50,
        duration: 15,
        description: "",
      });
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("medicalServices.errors.createFailed"));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    try {
      await updateMedicalService({
        id: editingService._id,
        data: {
          name: editForm.name.trim(),
          category: editForm.category.trim(),
          price: Number(editForm.price),
          duration: Number(editForm.duration),
          description: editForm.description.trim() || undefined,
          isActive: editForm.isActive,
        },
      }).unwrap();

      toast.success(t("medicalServices.success.updated"));
      setEditingService(null);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("medicalServices.errors.updateFailed"));
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return;

    try {
      await deactivateMedicalService(deactivateTarget._id).unwrap();
      toast.success(t("medicalServices.success.deactivated"));
      setDeactivateTarget(null);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("medicalServices.errors.deactivateFailed"));
    }
  };

  const columns: Column<MedicalService>[] = [
    {
      key: "code",
      header: t("medicalServices.table.code"),
      render: (svc) => (
        <span className="font-mono text-xs font-bold text-teal-dark">
          {svc.code}
        </span>
      ),
    },
    {
      key: "name",
      header: t("medicalServices.table.serviceDescription"),
      render: (svc) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink text-xs">{svc.name}</span>
          {svc.description && (
            <span className="text-[11px] text-slate-muted line-clamp-1">
              {svc.description}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: t("medicalServices.table.category"),
      render: (svc) => (
        <Badge variant="neutral" size="sm">
          {svc.category}
        </Badge>
      ),
    },
    {
      key: "duration",
      header: t("medicalServices.table.duration"),
      render: (svc) => (
        <span className="inline-flex items-center gap-1 text-xs text-slate-dark">
          <LuClock className="w-3 h-3 text-slate-light" />
          {svc.duration} mins
        </span>
      ),
    },
    {
      key: "price",
      header: t("medicalServices.table.standardFee"),
      render: (svc) => (
        <span className="font-bold text-ink text-xs">
          ${svc.price?.toFixed(2)}
        </span>
      ),
    },
    {
      key: "isActive",
      header: t("medicalServices.table.status"),
      render: (svc) => (
        <Badge
          variant={svc.isActive ? "success" : "neutral"}
          size="sm"
          dot
        >
          {svc.isActive ? t("common.active") : t("common.inactive")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (svc) => canManageServices ? (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(svc)}
            title={t("common.edit")}
          >
            <LuPencil className="w-3.5 h-3.5" />
          </Button>
          {svc.isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeactivateTarget(svc)}
              title={t("common.deactivate")}
              className="text-status-error hover:bg-status-error-bg"
            >
              <LuTrash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("medicalServices.title")}
        subtitle={t("medicalServices.subtitle")}
        actions={canManageServices ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<LuPlus className="w-4 h-4" />}
          >
            {t("medicalServices.addService")}
          </Button>
        ) : undefined}
      />

      {/* Filter and Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-44">
            <Select
              value={
                queryParams.isActive === undefined
                  ? ""
                  : queryParams.isActive
                  ? "true"
                  : "false"
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
              placeholder={t("common.allStatuses")}
              options={[
                { value: "", label: t("common.allStatuses") },
                { value: "true", label: t("medicalServices.activeServices") },
                { value: "false", label: t("medicalServices.inactiveServices") },
              ]}
            />
          </div>
        </div>

        <div className="text-xs text-slate-muted">
          {t("medicalServices.totalServices")} <strong className="text-ink">{data?.pagination?.total || 0}</strong>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle={t("medicalServices.emptyTitle")}
        emptyDescription={t("medicalServices.emptyDescription")}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
      />

      {/* Create Medical Service Modal */}
      <Modal
        isOpen={canManageServices && isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Medical Service"
        subtitle="Define a new procedure, consultation type, or clinical diagnostic item"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Service Name"
              placeholder="e.g. General Consultation"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
            <Input
              label="Procedure Code"
              placeholder="e.g. CNS-001"
              value={createForm.code}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, code: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Category"
              placeholder="e.g. Consultation"
              value={createForm.category}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, category: e.target.value }))
              }
              required
            />
            <Input
              label="Price ($)"
              type="number"
              step="0.01"
              min="0"
              value={createForm.price}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  price: parseFloat(e.target.value) || 0,
                }))
              }
              required
            />
            <Input
              label="Duration (Mins)"
              type="number"
              min="5"
              step="5"
              value={createForm.duration}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  duration: parseInt(e.target.value, 10) || 15,
                }))
              }
              required
            />
          </div>

          <Textarea
            label="Clinical Description"
            placeholder="Details regarding procedure prerequisites, follow-up rules, etc."
            value={createForm.description || ""}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, description: e.target.value }))
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
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreating}
              leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
            >
              Save Service
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Medical Service Modal */}
      <Modal
        isOpen={canManageServices && Boolean(editingService)}
        onClose={() => setEditingService(null)}
        title="Edit Medical Service"
        subtitle={`Editing ${editingService?.code} • ${editingService?.name}`}
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Service Name"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, name: e.target.value }))
              }
              required
            />
            <Input
              label="Category"
              value={editForm.category}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, category: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Price ($)"
              type="number"
              step="0.01"
              min="0"
              value={editForm.price}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  price: parseFloat(e.target.value) || 0,
                }))
              }
              required
            />
            <Input
              label="Duration (Mins)"
              type="number"
              min="5"
              step="5"
              value={editForm.duration}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  duration: parseInt(e.target.value, 10) || 15,
                }))
              }
              required
            />
            <Select
              label="Status"
              value={editForm.isActive ? "true" : "false"}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  isActive: e.target.value === "true",
                }))
              }
              options={[
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
            />
          </div>

          <Textarea
            label="Clinical Description"
            value={editForm.description}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, description: e.target.value }))
            }
            rows={3}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditingService(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isUpdating}
              leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
            >
              Update Service
            </Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate Service Modal */}
      <Modal
        isOpen={canManageServices && Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title="Deactivate Medical Service"
      >
        <div className="flex flex-col gap-4 text-xs">
          <p className="text-slate-muted">
            Are you sure you want to deactivate <strong className="text-ink">{deactivateTarget?.name}</strong> ({deactivateTarget?.code})?
            It will no longer appear as an option during consultation intake.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeactivateTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeactivating}
              onClick={handleDeactivateConfirm}
            >
              Confirm Deactivation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
