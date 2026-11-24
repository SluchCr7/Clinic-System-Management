"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGetDailyClosingQuery } from "@/services/api/paymentApi";
import {
  Modal,
  Button,
  Badge,
  Skeleton,
} from "@/components/ui";
import {
  LuPrinter,
  LuCalendarCheck,
  LuBanknote,
  LuCreditCard,
  LuSmartphone,
  LuWallet,
  LuUsers,
  LuRefreshCw,
} from "react-icons/lu";

interface DailyClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailyClosingModal({ isOpen, onClose }: DailyClosingModalProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: "Africa/Cairo",
    });
  });

  const { data, isLoading, isError, refetch } = useGetDailyClosingQuery(
    { date: selectedDate },
    { skip: !isOpen }
  );

  const report = data?.data;

  const getMethodIcon = (code: string) => {
    switch (code) {
      case "cash":
        return <LuBanknote className="w-5 h-5 text-emerald-600" />;
      case "card":
        return <LuCreditCard className="w-5 h-5 text-blue-600" />;
      case "vodafone_cash":
        return <LuSmartphone className="w-5 h-5 text-rose-600" />;
      default:
        return <LuWallet className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("invoices.payment.dailyClosing", "التقفيل اليومي للخزينة")}
      subtitle={t("payments.subtitle", "ملخص التحصيلات اليومية حسب طرق الدفع والموظفين")}
      size="xl"
    >
      <div className="flex flex-col gap-5 text-xs">
        {/* Date Selector & Refresh */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-paper rounded-lg border border-border-subtle">
          <div className="flex items-center gap-2">
            <LuCalendarCheck className="w-4 h-4 text-teal-primary shrink-0" />
            <span className="font-semibold text-slate-dark text-xs">
              {t("reports.date", "تاريخ الإغلاق")}:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1 text-xs border border-border-subtle rounded-md bg-surface font-mono text-ink focus:outline-hidden focus:ring-1 focus:ring-teal-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              leftIcon={<LuRefreshCw className="w-3.5 h-3.5" />}
            >
              {t("invoices.create.retry", "تحديث")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              leftIcon={<LuPrinter className="w-3.5 h-3.5" />}
            >
              {t("payments.printVoucher", "طباعة تقرير الإغلاق")}
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-40" />
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="p-4 bg-status-error-bg text-status-error rounded-lg text-center">
            {t("invoices.create.visitsError", "حدث خطأ أثناء تحميل تقرير الإغلاق اليومي.")}
          </div>
        )}

        {/* Report Content */}
        {!isLoading && !isError && report && (
          <div className="flex flex-col gap-5">
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-paper rounded-lg border border-border-subtle flex flex-col gap-1">
                <span className="text-[11px] text-slate-muted font-semibold uppercase">
                  {t("reports.payments.totalCollected", "إجمالي المبالغ المحصلة")}
                </span>
                <span className="text-xl font-bold text-teal-dark font-mono">
                  ${report.totalCollected?.toFixed(2)}
                </span>
              </div>

              <div className="p-3.5 bg-paper rounded-lg border border-border-subtle flex flex-col gap-1">
                <span className="text-[11px] text-slate-muted font-semibold uppercase">
                  {t("reports.payments.transactions", "عدد المعاملات")}
                </span>
                <span className="text-xl font-bold text-ink font-mono">
                  {report.totalTransactions}
                </span>
              </div>

              <div className="p-3.5 bg-paper rounded-lg border border-border-subtle flex flex-col gap-1">
                <span className="text-[11px] text-slate-muted font-semibold uppercase">
                  {isArabic ? "العمليات العكسية" : "Reversals"}
                </span>
                <span className="text-xl font-bold text-slate-dark font-mono">
                  {report.reversalsCount}
                </span>
              </div>
            </div>

            {/* Totals by Payment Method (Cards) */}
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-ink text-xs uppercase tracking-wider">
                {t("reports.payments.collectionsByMethod", "التحصيلات حسب طريقة الدفع")}
              </h4>

              {report.totalsByMethod && report.totalsByMethod.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {report.totalsByMethod.map((item) => {
                    const name = isArabic ? item.nameAr : item.nameEn;
                    return (
                      <div
                        key={item._id || item.code}
                        className="p-3 bg-surface rounded-lg border border-border-subtle flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-md bg-paper border border-border-subtle">
                            {getMethodIcon(item.code)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-ink">
                              {name || item.code}
                            </span>
                            <span className="text-[11px] text-slate-muted">
                              {item.count} {isArabic ? "معاملة" : "txns"}
                            </span>
                          </div>
                        </div>
                        <span className="font-bold text-sm text-teal-dark font-mono">
                          ${item.totalAmount?.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="p-3 bg-paper rounded border border-border-subtle text-slate-muted text-center italic">
                  {t("payments.emptyDescription", "لا توجد متحصلات مسجلة في هذا اليوم.")}
                </p>
              )}
            </div>

            {/* Totals by Receptionist / Staff */}
            <div className="flex flex-col gap-2">
              <h4 className="font-semibold text-ink text-xs uppercase tracking-wider">
                {isArabic ? "إجمالي التحصيل حسب موظف الاستقبال" : "Collections by Staff"}
              </h4>

              {report.totalsByReceptionist && report.totalsByReceptionist.length > 0 ? (
                <div className="border border-border-subtle rounded-md overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-paper text-slate-muted border-b border-border-subtle">
                      <tr>
                        <th className="py-2.5 px-3">
                          {t("invoices.payment.staffMember", "الموظف")}
                        </th>
                        <th className="py-2.5 px-3">
                          {t("reports.payments.collectionsByMethod", "تفاصيل الطرق")}
                        </th>
                        <th className="py-2.5 px-3 text-center">
                          {t("reports.payments.transactions", "المعاملات")}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {t("reports.payments.totalCollected", "الإجمالي")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {report.totalsByReceptionist.map((staff) => (
                        <tr key={staff._id || staff.staffEmail} className="hover:bg-paper/40">
                          <td className="py-2.5 px-3 font-semibold text-ink">
                            <div className="flex items-center gap-1.5">
                              <LuUsers className="w-3.5 h-3.5 text-slate-muted" />
                              <span>{staff.staffName || staff.staffEmail || "Staff"}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1.5">
                              {staff.byMethod.map((m, idx) => (
                                <Badge key={idx} variant="neutral" size="sm">
                                  {isArabic ? m.nameAr : m.nameEn}: ${m.totalAmount?.toFixed(2)}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-dark">
                            {staff.totalTransactions}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-teal-dark font-mono">
                            ${staff.totalAmount?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-3 bg-paper rounded border border-border-subtle text-slate-muted text-center italic">
                  {t("payments.emptyDescription", "لا توجد سجلات استقبال مسجلة لهذا اليوم.")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Modal Close */}
        <div className="flex justify-end pt-3 border-t border-border-subtle">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t("common.close", "إغلاق")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
