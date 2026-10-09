"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} from "@/services/api/notificationApi";
import type {
  NotificationQueryParams,
  NotificationType,
} from "@/types/notification";
import {
  PageHeader,
  Button,
  Select,
  Badge,
  Skeleton,
  EmptyState,
  toast,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import {
  LuBell,
  LuCalendar,
  LuFlaskConical,
  LuCreditCard,
  LuFileText,
  LuPaperclip,
  LuCheckCheck,
  LuCheck,
  LuInfo,
} from "react-icons/lu";

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [queryParams, setQueryParams] = useState<NotificationQueryParams>({
    page: 1,
    limit: 20,
    isRead: undefined,
    type: undefined,
  });

  const { data, isLoading, isError, refetch } = useGetNotificationsQuery(
    queryParams,
    { pollingInterval: 60_000 }
  );
  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead, { isLoading: isMarkingAll }] = useMarkAllAsReadMutation();

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id).unwrap();
      toast.success(t("notifications.markAsReadSuccess"));
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("notifications.markAsReadFailed"));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead().unwrap();
      toast.success(t("notifications.markAllReadSuccess"));
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("notifications.markAllReadFailed"));
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "appointment":
        return <LuCalendar className="w-4 h-4 text-teal-primary" />;
      case "lab_order":
        return <LuFlaskConical className="w-4 h-4 text-status-info" />;
      case "payment":
        return <LuCreditCard className="w-4 h-4 text-status-success" />;
      case "prescription":
        return <LuFileText className="w-4 h-4 text-amber-500" />;
      case "medical_attachment":
        return <LuPaperclip className="w-4 h-4 text-slate-dark" />;
      default:
        return <LuInfo className="w-4 h-4 text-slate-muted" />;
    }
  };

  const notifications = data?.data || [];
  const unreadExist = notifications.some((n) => !n.isRead);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        actions={
          unreadExist && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              isLoading={isMarkingAll}
              leftIcon={<LuCheckCheck className="w-4 h-4" />}
            >
              {t("notifications.markAllRead")}
            </Button>
          )
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-40">
            <Select
              value={
                queryParams.isRead === undefined
                  ? ""
                  : queryParams.isRead
                  ? "true"
                  : "false"
              }
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  isRead:
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "true",
                  page: 1,
                }))
              }
              placeholder={t("notifications.allStatus")}
              options={[
                { value: "", label: t("notifications.allNotifications") },
                { value: "false", label: t("notifications.unreadOnly") },
                { value: "true", label: t("notifications.readOnly") },
              ]}
            />
          </div>

          <div className="w-44">
            <Select
              value={queryParams.type || ""}
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  type: (e.target.value as NotificationType) || undefined,
                  page: 1,
                }))
              }
              placeholder={t("notifications.allCategories")}
              options={[
                { value: "", label: t("notifications.allCategories") },
                { value: "appointment", label: t("notifications.appointments") },
                { value: "lab_order", label: t("notifications.labOrders") },
                { value: "payment", label: t("notifications.payments") },
                { value: "prescription", label: t("notifications.prescriptions") },
                { value: "system", label: t("notifications.systemAlerts") },
              ]}
            />
          </div>
        </div>

        <div className="text-xs text-slate-muted">
          {t("notifications.total")}: <strong className="text-ink">{data?.pagination?.total || 0}</strong>
        </div>
      </div>

      {/* Notification Stream */}
      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center bg-surface border border-border-subtle rounded-xl">
          <p className="text-xs text-status-error">{t("notifications.failedLoad")}</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()} className="mt-3">
            {t("notifications.retry")}
          </Button>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title={t("notifications.noNotifications")}
          description={t("notifications.noNotificationsDescription")}
          icon={<LuBell className="w-6 h-6 text-slate-muted" />}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <div
              key={n._id}
              className={`p-3.5 rounded-lg border transition-all flex items-start justify-between gap-4 ${
                !n.isRead
                  ? "bg-mint/20 border-teal-primary/30 shadow-xs"
                  : "bg-surface border-border-subtle hover:bg-paper/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-md shrink-0 mt-0.5 ${
                    !n.isRead ? "bg-mint text-teal-dark" : "bg-paper text-slate-muted"
                  }`}
                >
                  {getNotificationIcon(n.type)}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-ink">{n.title}</span>
                    {!n.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-primary shrink-0" />
                    )}
                    <Badge variant="neutral" size="sm" className="capitalize text-[10px]">
                      {n.type.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-dark leading-relaxed">{n.message}</p>
                  <span className="text-[11px] text-slate-muted font-mono mt-0.5">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {!n.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkAsRead(n._id)}
                  title="Mark as read"
                  className="shrink-0 text-slate-light hover:text-teal-dark hover:bg-mint/40"
                >
                  <LuCheck className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
