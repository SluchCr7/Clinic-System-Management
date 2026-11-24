"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetPaymentsQuery,
  useGetPaymentMethodsQuery,
} from "@/services/api/paymentApi";
import type { Payment, PaymentQueryParams, PaymentMethodCode } from "@/types/payment";
import { DailyClosingModal } from "@/components/payments/DailyClosingModal";
import {
  PageHeader,
  DataTable,
  Button,
  Select,
  Badge,
  Modal,
  type Column,
} from "@/components/ui";
import {
  LuCreditCard,
  LuPrinter,
  LuEye,
  LuBanknote,
  LuBuilding2,
  LuShield,
  LuGlobe,
  LuSmartphone,
  LuCalendarCheck,
} from "react-icons/lu";

export default function PaymentsPage() {
  const { t, i18n } = useTranslation();
  const [queryParams, setQueryParams] = useState<PaymentQueryParams>({
    page: 1,
    limit: 10,
    method: undefined,
    sortBy: "paidAt",
    sortOrder: "desc",
  });

  const { data, isLoading, isError, refetch } = useGetPaymentsQuery(queryParams);
  const { data: methodsData } = useGetPaymentMethodsQuery();
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [isDailyClosingOpen, setIsDailyClosingOpen] = useState(false);

  const getMethodBadge = (payment: Payment | PaymentMethodCode) => {
    const code =
      typeof payment === "string"
        ? payment
        : typeof payment.paymentMethod === "object" && payment.paymentMethod
        ? payment.paymentMethod.code
        : payment.method;

    const label =
      typeof payment === "object" &&
      typeof payment.paymentMethod === "object" &&
      payment.paymentMethod
        ? (i18n.language === "ar"
            ? payment.paymentMethod.nameAr
            : payment.paymentMethod.nameEn)
        : t(`payments.methods.${code}`, code);

    switch (code) {
      case "cash":
        return (
          <Badge variant="teal" size="sm" className="gap-1">
            <LuBanknote className="w-3 h-3" /> {label}
          </Badge>
        );
      case "card":
        return (
          <Badge variant="info" size="sm" className="gap-1">
            <LuCreditCard className="w-3 h-3" /> {label}
          </Badge>
        );
      case "vodafone_cash":
        return (
          <Badge variant="warning" size="sm" className="gap-1 bg-red-50 text-red-700 border-red-200">
            <LuSmartphone className="w-3 h-3 text-red-600" /> {label}
          </Badge>
        );
      case "bank_transfer":
        return (
          <Badge variant="neutral" size="sm" className="gap-1">
            <LuBuilding2 className="w-3 h-3" /> {label}
          </Badge>
        );
      case "online":
        return (
          <Badge variant="teal" size="sm" className="gap-1">
            <LuGlobe className="w-3 h-3" /> {label}
          </Badge>
        );
      case "insurance":
        return (
          <Badge variant="warning" size="sm" className="gap-1">
            <LuShield className="w-3 h-3" /> {label}
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            {label}
          </Badge>
        );
    }
  };

  const columns: Column<Payment>[] = [
    {
      key: "paidAt",
      header: t("payments.paymentDate"),
      render: (p) => (
        <span className="text-xs font-mono text-ink">
          {new Date(p.paidAt || p.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "invoice",
      header: t("payments.invoiceReference"),
      render: (p) => {
        const inv = typeof p.invoice === "object" && p.invoice ? p.invoice : null;
        return (
          <span className="font-mono text-xs font-semibold text-teal-dark">
            #{inv?.invoiceNumber || (typeof p.invoice === "string" ? p.invoice.slice(-6).toUpperCase() : "-")}
          </span>
        );
      },
    },
    {
      key: "patient",
      header: t("payments.patient"),
      render: (p) => {
        const pt = typeof p.patient === "object" && p.patient ? p.patient : null;
        return (
          <span className="font-medium text-ink text-xs">
            {pt ? `${pt.firstName} ${pt.lastName}` : t("payments.patient")}
          </span>
        );
      },
    },
    {
      key: "method",
      header: t("payments.paymentMethod"),
      render: (p) => getMethodBadge(p),
    },
    {
      key: "transactionReference",
      header: t("payments.referenceNumber"),
      render: (p) => (
        <span className="font-mono text-xs text-slate-muted">
          {p.referenceNumber || p.transactionReference || "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: t("payments.amountPaid"),
      render: (p) => (
        <span className="font-bold text-ink text-xs">
          ${p.amount?.toFixed(2)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setReceiptPayment(p)}
          leftIcon={<LuEye className="w-3.5 h-3.5" />}
        >
          {t("payments.receipt")}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("payments.title")}
        subtitle={t("payments.subtitle")}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDailyClosingOpen(true)}
            leftIcon={<LuCalendarCheck className="w-3.5 h-3.5 text-teal-primary" />}
          >
            {t("invoices.payment.dailyClosing", "التقفيل اليومي للخزينة")}
          </Button>
        }
      />

      {/* Filter and Overview */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-48">
            <Select
              value={queryParams.method || ""}
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  method: e.target.value || undefined,
                  page: 1,
                }))
              }
              placeholder={t("payments.allMethods")}
              options={[
                { value: "", label: t("payments.allMethods") },
                ...(methodsData?.data?.map((m) => ({
                  value: m.code,
                  label: i18n.language === "ar" ? m.nameAr : m.nameEn,
                })) || [
                  { value: "cash", label: t("payments.methods.cash") },
                  { value: "card", label: t("payments.methods.card") },
                  { value: "vodafone_cash", label: t("payments.methods.vodafone_cash") },
                ]),
              ]}
            />
          </div>
        </div>

        <div className="text-xs text-slate-muted">
          {t("payments.totalTransactions")}: <strong className="text-ink">{data?.pagination?.total || 0}</strong>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle={t("payments.emptyTitle")}
        emptyDescription={t("payments.emptyDescription")}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
      />

      {/* Printable Receipt Voucher Modal */}
      <Modal
        isOpen={Boolean(receiptPayment)}
        onClose={() => setReceiptPayment(null)}
        title={t("payments.receiptTitle")}
        subtitle={`${t("payments.voucherId")}: ${receiptPayment?._id.slice(-8).toUpperCase()}`}
      >
        {receiptPayment && (
          <div className="flex flex-col gap-4 text-xs">
            {/* Clinical Brand Receipt Header */}
            <div className="text-center pb-3 border-b border-border-subtle">
              <h3 className="font-bold text-base text-ink">AEGIS CLINICAL SUITE</h3>
              <p className="text-slate-muted text-[11px]">{t("payments.officialReceipt")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-paper rounded-lg">
              <div>
                <span className="text-[10px] uppercase text-slate-muted font-semibold">{t("common.dateTime")}:</span>
                <p className="font-medium text-ink">
                  {new Date(receiptPayment.paidAt || receiptPayment.createdAt).toLocaleString()}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase text-slate-muted font-semibold">{t("payments.invoiceReference")}:</span>
                <p className="font-mono font-medium text-teal-dark">
                  #{typeof receiptPayment.invoice === "object" && receiptPayment.invoice
                    ? receiptPayment.invoice.invoiceNumber
                    : (typeof receiptPayment.invoice === "string" ? receiptPayment.invoice.slice(-6).toUpperCase() : "-")}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase text-slate-muted font-semibold">{t("payments.patient")}:</span>
                <p className="font-semibold text-ink">
                  {typeof receiptPayment.patient === "object" && receiptPayment.patient
                    ? `${receiptPayment.patient.firstName} ${receiptPayment.patient.lastName}`
                    : t("payments.patient")}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase text-slate-muted font-semibold">{t("payments.paymentMethod")}:</span>
                <div className="mt-0.5">{getMethodBadge(receiptPayment)}</div>
              </div>

              {(receiptPayment.referenceNumber || receiptPayment.transactionReference) && (
                <div>
                  <span className="text-[10px] uppercase text-slate-muted font-semibold">{t("payments.referenceNumber", "رقم العملية / المرجع")}:</span>
                  <p className="font-mono text-ink">{receiptPayment.referenceNumber || receiptPayment.transactionReference}</p>
                </div>
              )}

              {(receiptPayment.receivedBy || receiptPayment.createdBy) && (
                <div>
                  <span className="text-[10px] uppercase text-slate-muted font-semibold">{t("invoices.payment.staffMember", "الموظف المستلم")}:</span>
                  <p className="font-medium text-ink">
                    {typeof receiptPayment.receivedBy === "object" && receiptPayment.receivedBy
                      ? `${receiptPayment.receivedBy.firstName} ${receiptPayment.receivedBy.lastName}`
                      : typeof receiptPayment.createdBy === "object" && receiptPayment.createdBy
                      ? `${receiptPayment.createdBy.firstName} ${receiptPayment.createdBy.lastName}`
                      : "—"}
                  </p>
                </div>
              )}
            </div>

            {/* Total Paid Display */}
            <div className="flex items-center justify-between p-3.5 bg-mint/50 border border-teal-primary/20 rounded-lg">
              <span className="font-bold text-ink uppercase tracking-wider text-xs">{t("payments.amountCollected")}</span>
              <span className="font-bold text-xl text-teal-dark">
                ${receiptPayment.amount?.toFixed(2)}
              </span>
            </div>

            {receiptPayment.notes && (
              <div className="p-2.5 bg-paper rounded text-slate-muted text-xs">
                <span className="font-semibold text-ink">{t("payments.remarks")}: </span>
                {receiptPayment.notes}
              </div>
            )}

            {/* Footer / Signature line */}
            <div className="pt-4 border-t border-dashed border-border-subtle flex justify-between items-end text-[11px] text-slate-muted">
              <div>
                <p>{t("common.status")}: <span className="text-status-success font-semibold">{t("payments.settledVerified")}</span></p>
                <p className="text-[10px]">{t("payments.thankYou")}</p>
              </div>
              <div className="text-right">
                <div className="w-32 border-b border-border-subtle mb-1"></div>
                <span>{t("payments.authorizedCashier")}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                leftIcon={<LuPrinter className="w-3.5 h-3.5" />}
              >
                {t("payments.printVoucher")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setReceiptPayment(null)}
              >
                {t("common.done")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* Daily Closing Register Modal */}
      <DailyClosingModal
        isOpen={isDailyClosingOpen}
        onClose={() => setIsDailyClosingOpen(false)}
      />
    </div>
  );
}
