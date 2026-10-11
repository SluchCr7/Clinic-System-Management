"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeactivateUserMutation,
} from "@/services/api/userApi";
import type {
  User,
  UserQueryParams,
  UserRole,
  CreateUserRequest,
} from "@/types/user";
import {
  PageHeader,
  DataTable,
  Button,
  Select,
  Input,
  Badge,
  Avatar,
  Modal,
  toast,
  type Column,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import {
  LuPlus,
  LuPencil,
  LuTrash2,
  LuCircleCheck,
} from "react-icons/lu";

export default function UsersPage() {
  const { t } = useTranslation();
  const [queryParams, setQueryParams] = useState<UserQueryParams>({
    page: 1,
    limit: 10,
    search: "",
    role: undefined,
    isActive: undefined,
  });

  const { data, isLoading, isError, refetch } = useGetUsersQuery(queryParams);
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deactivateUser, { isLoading: isDeactivating }] = useDeactivateUserMutation();

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    role: "receptionist",
  });

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: UserRole;
    isActive: boolean;
  }>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "receptionist",
    isActive: true,
  });

  // Deactivate Modal State
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      isActive: user.isActive,
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.email.trim() || !createForm.password) {
      toast.error(t("users.errors.requiredFields"));
      return;
    }

    try {
      await createUser({
        ...createForm,
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim().toLowerCase(),
        phone: createForm.phone.trim(),
      }).unwrap();

      toast.success(t("users.success.created"));
      setIsCreateOpen(false);
      setCreateForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        phone: "",
        role: "receptionist",
      });
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("users.errors.createFailed"));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await updateUser({
        id: editingUser._id,
        data: {
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          email: editForm.email.trim().toLowerCase(),
          phone: editForm.phone.trim(),
          role: editForm.role,
          isActive: editForm.isActive,
        },
      }).unwrap();

      toast.success(t("users.success.updated"));
      setEditingUser(null);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("users.errors.updateFailed"));
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return;

    try {
      await deactivateUser(deactivateTarget._id).unwrap();
      toast.success(t("users.success.deactivated"));
      setDeactivateTarget(null);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("users.errors.deactivateFailed"));
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "admin":
        return <Badge variant="neutral" size="sm" className="font-semibold text-ink">{t("users.administrator")}</Badge>;
      case "doctor":
        return <Badge variant="teal" size="sm">{t("users.physician")}</Badge>;
      case "receptionist":
        return <Badge variant="info" size="sm">{t("users.receptionist")}</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{role}</Badge>;
    }
  };

  const columns: Column<User>[] = [
    {
      key: "name",
      header: t("users.staffMember"),
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar
            name={`${u.firstName} ${u.lastName}`}
            src={u.profilePhoto?.url}
            size="sm"
          />
          <div className="flex flex-col">
            <span className="font-semibold text-ink text-xs">
              {u.firstName} {u.lastName}
            </span>
            <span className="text-[11px] text-slate-muted">{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: t("users.systemRole"),
      render: (u) => getRoleBadge(u.role),
    },
    {
      key: "phone",
      header: t("users.phoneNumber"),
      render: (u) => (
        <span className="text-xs font-mono text-slate-dark">
          {u.phone || "—"}
        </span>
      ),
    },
    {
      key: "isActive",
      header: t("users.status"),
      render: (u) => (
        <Badge variant={u.isActive ? "success" : "neutral"} size="sm" dot>
          {u.isActive ? t("users.active") : t("users.inactive")}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: t("users.enrolledDate"),
      render: (u) => (
        <span className="text-xs text-slate-muted font-mono">
          {new Date(u.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (u) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(u)}
            title={t("users.editStaff")}
          >
            <LuPencil className="w-3.5 h-3.5" />
          </Button>
          {u.isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeactivateTarget(u)}
              title={t("users.deactivateAccount")}
              className="text-status-error hover:bg-status-error-bg"
            >
              <LuTrash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<LuPlus className="w-4 h-4" />}
          >
            {t("users.addUser")}
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-40">
            <Select
              value={queryParams.role || ""}
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  role: (e.target.value as UserRole) || undefined,
                  page: 1,
                }))
              }
              placeholder={t("users.allRoles")}
              options={[
                { value: "", label: t("users.allRoles") },
                { value: "admin", label: t("users.administrators") },
                { value: "doctor", label: t("users.physicians") },
                { value: "receptionist", label: t("users.receptionists") },
              ]}
            />
          </div>

          <div className="w-36">
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
              placeholder={t("users.allStatus")}
              options={[
                { value: "", label: t("users.allStatus") },
                { value: "true", label: t("users.active") },
                { value: "false", label: t("users.inactive") },
              ]}
            />
          </div>
        </div>

        <div className="text-xs text-slate-muted">
          {t("users.totalUsers")}: <strong className="text-ink">{data?.pagination?.total || 0}</strong>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle={t("users.emptyTitle")}
        emptyDescription={t("users.emptyDescription")}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
      />

      {/* Create Staff Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t("users.createTitle")}
        subtitle={t("users.createSubtitle")}
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("users.firstName")}
              placeholder={t("users.firstNamePlaceholder")}
              value={createForm.firstName}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, firstName: e.target.value }))
              }
              required
            />
            <Input
              label={t("users.lastName")}
              placeholder={t("users.lastNamePlaceholder")}
              value={createForm.lastName}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, lastName: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("users.emailAddress")}
              type="email"
              placeholder={t("users.emailPlaceholder")}
              value={createForm.email}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, email: e.target.value }))
              }
              required
            />
            <Input
              label={t("users.phoneNumber")}
              placeholder={t("users.phonePlaceholder")}
              value={createForm.phone}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, phone: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t("users.systemRole")}
              value={createForm.role}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, role: e.target.value as UserRole }))
              }
              options={[
                { value: "receptionist", label: t("users.receptionist") },
                { value: "doctor", label: t("users.physician") },
                { value: "admin", label: t("users.administrator") },
              ]}
            />
            <Input
              label={t("users.temporaryPassword")}
              type="password"
              placeholder={t("users.passwordMin")}
              value={createForm.password}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, password: e.target.value }))
              }
              required
            />
          </div>

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
              isLoading={isCreating}
              leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
            >
              {t("users.createAccount")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Staff Modal */}
      <Modal
        isOpen={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title={t("users.editTitle")}
        subtitle={t("users.editSubtitle", { name: `${editingUser?.firstName} ${editingUser?.lastName}` })}
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("users.firstName")}
              value={editForm.firstName}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, firstName: e.target.value }))
              }
              required
            />
            <Input
              label={t("users.lastName")}
              value={editForm.lastName}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, lastName: e.target.value }))
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("users.emailAddress")}
              type="email"
              value={editForm.email}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, email: e.target.value }))
              }
              required
            />
            <Input
              label={t("users.phoneNumber")}
              value={editForm.phone}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t("users.systemRole")}
              value={editForm.role}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, role: e.target.value as UserRole }))
              }
              options={[
                { value: "receptionist", label: t("users.receptionist") },
                { value: "doctor", label: t("users.physician") },
                { value: "admin", label: t("users.administrator") },
              ]}
            />
            <Select
              label={t("users.accountStatus")}
              value={editForm.isActive ? "true" : "false"}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  isActive: e.target.value === "true",
                }))
              }
              options={[
                { value: "true", label: t("users.active") },
                { value: "false", label: t("users.inactive") },
              ]}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditingUser(null)}
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
              {t("common.saveChanges")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate User Modal */}
      <Modal
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        title={t("users.deactivateAccount")}
      >
        <div className="flex flex-col gap-4 text-xs">
          <p className="text-slate-muted">
            {t("users.confirmDeactivateBody", {
              name: `${deactivateTarget?.firstName} ${deactivateTarget?.lastName}`,
              email: deactivateTarget?.email,
            })}
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeactivateTarget(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeactivating}
              onClick={handleDeactivateConfirm}
            >
              {t("users.confirmDeactivate")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
