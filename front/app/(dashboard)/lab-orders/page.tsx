"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/redux/hooks";
import { selectUserRole } from "@/features/auth/authSelectors";
import {
  useGetLabOrdersQuery,
  useUpdateLabOrderItemMutation,
} from "@/services/api/labOrderApi";
import type {
  GroupedLabOrderCard,
  LabOrderItem,
  GroupedLabOrderQueryParams,
} from "@/types/labOrder";
import {
  PageHeader,
  Button,
  CustomSelect,
  Input,
  Badge,
  Skeleton,
  EmptyState,
  toast,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import { UpdateLabOrderStatusModal } from "@/components/lab-orders/UpdateLabOrderStatusModal";
import {
  LuFlaskConical,
  LuScanLine,
  LuExternalLink,
  LuCheck,
  LuFileText,
  LuCalendar,
  LuUser,
  LuPhone,
  LuSearch,
  LuFilter,
  LuSquarePen,
  LuClock,
  LuDownload,
} from "react-icons/lu";

export default function LabOrdersPage() {
  const { t } = useTranslation();
  const role = useAppSelector(selectUserRole);
  const isDoctor = role === "doctor";

  // Default filter: "pending" (Pending only) per key UX requirement
  const [filterMode, setFilterMode] = useState<"pending" | "all">("pending");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const queryParams: GroupedLabOrderQueryParams = {
    page,
    limit: 10,
    filter: filterMode,
    status: statusFilter !== "all" ? statusFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    search: searchQuery.trim() || undefined,
    date: dateFilter || undefined,
  };

  const { data, isLoading, isError, refetch } = useGetLabOrdersQuery(queryParams);
  const [updateItem, { isLoading: isQuickUpdating }] = useUpdateLabOrderItemMutation();

  // Active modal state
  const [selectedItem, setSelectedItem] = useState<{
    item: LabOrderItem;
    patientName: string;
  } | null>(null);

  // Quick "Mark as received" directly from card (Doctor only)
  const handleQuickReceive = async (itemId: string, itemName: string) => {
    try {
      await updateItem({
        id: itemId,
        data: {
          status: "received",
          receivedAt: new Date().toISOString(),
        },
      }).unwrap();
      toast.success(`تم تسجيل استلام نتيجة "${itemName}" بنجاح`);
    } catch (err) {
      const errInfo = extractApiError(err);
      toast.error(errInfo.message || "فشل تسجيل استلام النتيجة");
    }
  };

  const cards: GroupedLabOrderCard[] = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="طلبات التحاليل والأشعة الطبية"
        subtitle="متابعة واستلام نتائج الفحوصات التشخيصية مجمعة حسب المريض والزيارة"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFilterMode("pending");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                filterMode === "pending"
                  ? "bg-teal-primary text-white shadow-sm"
                  : "bg-surface border border-border-subtle text-slate-muted hover:text-ink"
              }`}
            >
              المعلقة فقط
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode("all");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                filterMode === "all"
                  ? "bg-teal-primary text-white shadow-sm"
                  : "bg-surface border border-border-subtle text-slate-muted hover:text-ink"
              }`}
            >
              جميع الطلبات
            </button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="bg-surface p-4 rounded-xl border border-border-subtle shadow-card flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="ابحث باسم المريض أو الهاتف..."
              className="ps-9"
            />
            <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none text-slate-muted">
              <LuSearch className="w-4 h-4" />
            </div>
          </div>

          {/* Type Filter */}
          <CustomSelect
            value={typeFilter}
            onChange={(val) => {
              setTypeFilter(val);
              setPage(1);
            }}
            options={[
              { value: "all", label: "جميع الأنواع (تحاليل وأشعة)" },
              { value: "lab", label: "تحاليل مخبرية فقط" },
              { value: "radiology", label: "أشعة وتصوير طبي فقط" },
            ]}
          />

          {/* Priority Filter */}
          <CustomSelect
            value={priorityFilter}
            onChange={(val) => {
              setPriorityFilter(val);
              setPage(1);
            }}
            options={[
              { value: "all", label: "جميع الأولويات" },
              { value: "urgent", label: "عاجل (Urgent)" },
              { value: "routine", label: "عادي (Routine)" },
            ]}
          />

          {/* Status Filter (available if viewing all) */}
          <CustomSelect
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            options={[
              { value: "all", label: "جميع الحالات" },
              { value: "ordered", label: "قيد الانتظار" },
              { value: "received", label: "تم استلام النتيجة" },
              { value: "cancelled", label: "ملغي" },
            ]}
          />

          {/* Date Filter */}
          <div className="relative">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="absolute inset-y-0 end-2 flex items-center text-[10px] text-teal-primary hover:underline"
              >
                مسح
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center bg-surface border border-border-subtle rounded-xl flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-status-error">
            حدث خطأ أثناء تحميل طلبات التحاليل والأشعة
          </p>
          <Button variant="secondary" size="sm" onClick={refetch}>
            إعادة المحاولة
          </Button>
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          title={filterMode === "pending" ? "لا توجد طلبات معلقة بانتظار النتائج" : "لا توجد طلبات تحاليل وأشعة مسجلة"}
          description={
            filterMode === "pending"
              ? "تم استلام كافة نتائج الفحوصات الطبية أو لم يتم طلب فحوصات معلقة مؤخراً."
              : "لم يتم العثور على أي نتائج مطابقة لمعايير البحث الحالية."
          }
          icon={<LuFlaskConical className="w-6 h-6" />}
          actionNode={
            filterMode === "pending" ? (
              <Button variant="secondary" size="sm" onClick={() => setFilterMode("all")}>
                عرض جميع الطلبات
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {/* List of Grouped Visit Cards */}
          {cards.map((card) => {
            const patientName = `${card.patient?.firstName || ""} ${card.patient?.lastName || ""}`.trim() || "مريض غير معروف";
            const visitDate = card.visit?.createdAt
              ? new Date(card.visit.createdAt).toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "تاريخ غير محدد";

            const isUrgent = card.priority === "urgent";

            return (
              <div
                key={card._id}
                className={`bg-surface rounded-xl border transition-shadow overflow-hidden shadow-card ${
                  isUrgent
                    ? "border-amber-500/50 hover:shadow-amber-500/10"
                    : "border-border-subtle hover:border-border-medium"
                }`}
              >
                {/* Card Header */}
                <div
                  className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
                    isUrgent ? "bg-amber-500/10 border-amber-500/20" : "bg-paper/60 border-border-subtle"
                  }`}
                >
                  {/* Left: Patient Info & Visit Link */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-teal-primary/15 text-teal-primary flex items-center justify-center font-bold text-sm">
                      <LuUser className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-sm sm:text-base">
                          {patientName}
                        </span>
                        {card.patient?.phone && (
                          <span className="text-[11px] text-slate-muted flex items-center gap-1 font-mono">
                            <LuPhone className="w-3 h-3" />
                            {card.patient.phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-muted mt-0.5">
                        <span className="flex items-center gap-1">
                          <LuCalendar className="w-3.5 h-3.5" />
                          زيارة: {visitDate}
                        </span>
                        <span>•</span>
                        <Link
                          href={`/visits/${card.visit._id}`}
                          className="inline-flex items-center gap-1 text-teal-primary hover:underline font-semibold"
                        >
                          فتح الزيارة
                          <LuExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Right: Priority, Progress Indicator & Status Badge */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Priority Badge */}
                    {isUrgent ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 shadow-sm animate-pulse">
                        عاجل (Urgent)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-paper border border-border-subtle text-slate-muted">
                        عادي
                      </span>
                    )}

                    {/* Progress Indicator: "2 of 5 received" */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-paper border border-border-subtle text-xs font-bold text-ink">
                      <span>تم استلام</span>
                      <span className="text-teal-primary font-mono">{card.counts.received}</span>
                      <span>من</span>
                      <span className="font-mono">{card.counts.total}</span>
                    </div>

                    {/* Pending / Completed Badge */}
                    {card.hasPending ? (
                      <Badge variant="warning" size="sm" dot>
                        {card.counts.pending} قيد الانتظار
                      </Badge>
                    ) : (
                      <Badge variant="success" size="sm" dot>
                        مكتمل
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Card Items List */}
                <div className="divide-y divide-border-subtle">
                  {card.items.map((item) => {
                    const isLab = item.type === "lab" || item.type === "LAB";
                    const isItemPending =
                      item.status === "ordered" ||
                      item.status === "REQUESTED";
                    const isItemReceived =
                      item.status === "received" ||
                      item.status === "RESULT_RECEIVED";
                    const isItemCancelled =
                      item.status === "cancelled" ||
                      item.status === "CANCELLED";

                    return (
                      <div
                        key={item._id}
                        className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          isItemPending
                            ? "bg-surface hover:bg-paper/30"
                            : isItemReceived
                            ? "bg-teal-500/[0.02] hover:bg-teal-500/[0.05]"
                            : "bg-paper/40 opacity-70"
                        }`}
                      >
                        {/* Item Details */}
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                              isLab
                                ? "bg-teal-primary/15 text-teal-primary"
                                : "bg-purple-500/15 text-purple-400"
                            }`}
                          >
                            {isLab ? (
                              <LuFlaskConical className="w-4 h-4" />
                            ) : (
                              <LuScanLine className="w-4 h-4" />
                            )}
                          </div>

                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-ink text-xs sm:text-sm">
                                {item.name}
                              </span>
                              {item.code && (
                                <span className="font-mono text-[10px] text-slate-muted bg-paper px-1.5 py-0.5 rounded border border-border-subtle">
                                  {item.code}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-muted">
                                {isLab ? "تحليل مخبري" : "أشعة وتصوير"}
                              </span>
                            </div>

                            {/* Center Name & Notes */}
                            {item.labName && (
                              <span className="text-[11px] text-teal-light font-medium">
                                المركز / المعمل: {item.labName}
                              </span>
                            )}
                            {item.resultNotes && (
                              <p className="text-[11px] text-slate-muted line-clamp-2">
                                النتيجة: {item.resultNotes}
                              </p>
                            )}
                            {isItemCancelled && item.cancelReason && (
                              <p className="text-[11px] text-status-error">
                                سبب الإلغاء: {item.cancelReason}
                              </p>
                            )}

                            {/* Attached Files */}
                            {item.resultFiles && item.resultFiles.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                {item.resultFiles.map((file) => (
                                  <a
                                    key={file._id}
                                    href={`/api/lab-order-items/${item._id}/files/${file._id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-paper border border-border-subtle text-[11px] text-teal-primary hover:underline font-medium"
                                  >
                                    <LuFileText className="w-3 h-3" />
                                    <span>{file.originalName}</span>
                                    <LuDownload className="w-2.5 h-2.5" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status Badge & Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {/* Item Status Badge */}
                          {isItemReceived && (
                            <Badge variant="success" size="sm" dot>
                              تم استلام النتيجة
                            </Badge>
                          )}
                          {isItemPending && (
                            <Badge variant="teal" size="sm" dot>
                              قيد الانتظار
                            </Badge>
                          )}
                          {isItemCancelled && (
                            <Badge variant="error" size="sm" dot>
                              ملغي
                            </Badge>
                          )}

                          {/* DOCTOR ONLY ACTIONS (Hidden completely for staff) */}
                          {isDoctor && (
                            <div className="flex items-center gap-1.5 ms-2">
                              {/* Quick "Mark as received" button */}
                              {isItemPending && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={isQuickUpdating}
                                  onClick={() => handleQuickReceive(item._id, item.name)}
                                  leftIcon={<LuCheck className="w-3.5 h-3.5" />}
                                  className="text-xs py-1"
                                >
                                  استلام سريع
                                </Button>
                              )}

                              {/* Update Status button with icon */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setSelectedItem({
                                    item,
                                    patientName,
                                  })
                                }
                                leftIcon={<LuSquarePen className="w-3.5 h-3.5" />}
                                className="text-xs py-1"
                              >
                                تحديث الحالة
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {pagination && (pagination.pages || (pagination as any).totalPages || 1) > 1 && (
            <div className="p-4 border border-border-subtle bg-surface rounded-xl flex items-center justify-between text-xs text-slate-muted">
              <div>
                عرض{" "}
                <span className="font-semibold text-ink">
                  {Math.min((page - 1) * pagination.limit + 1, pagination.total)}
                </span>{" "}
                إلى{" "}
                <span className="font-semibold text-ink">
                  {Math.min(page * pagination.limit, pagination.total)}
                </span>{" "}
                من{" "}
                <span className="font-semibold text-ink">{pagination.total}</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  السابق
                </Button>
                <span className="font-bold text-ink px-2">
                  {page} / {pagination.pages || (pagination as any).totalPages || 1}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= (pagination.pages || (pagination as any).totalPages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Doctor Update Status Modal */}
      {selectedItem && (
        <UpdateLabOrderStatusModal
          isOpen={Boolean(selectedItem)}
          onClose={() => setSelectedItem(null)}
          item={selectedItem.item}
          patientName={selectedItem.patientName}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
