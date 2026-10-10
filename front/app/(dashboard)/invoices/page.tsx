"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetInvoicesQuery,
  useCancelInvoiceMutation,
} from "@/services/api/invoiceApi";
import { useCreatePaymentMutation } from "@/services/api/paymentApi";
import type { Invoice, InvoiceQueryParams, InvoiceStatus } from "@/types/invoice";
import type { PaymentMethod } from "@/types/payment";
import {
  PageHeader,
  DataTable,
  Button,
  Select,
  Input,
  Textarea,
  StatusBadge,
  Modal,
  toast,
  type Column,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import { selectUserRole } from "@/features/auth/authSelectors";
import { useAppSelector } from "@/redux/hooks";
import { hasPermission } from "@/lib/permissions";
import {
  LuCreditCard,
  LuPrinter,
  LuBan,
  LuCircleCheck,
  LuTriangleAlert,
  LuEye,
} from "react-icons/lu";

export default function InvoicesPage() {
  const { t } = useTranslation();
  const role = useAppSelector(selectUserRole);
  const canManageBilling = hasPermission(role, "billing.manage");

  const [queryParams, setQueryParams] = useState<InvoiceQueryParams>({
    page: 1,
    limit: 10,
    status: undefined,
    sortBy: "issuedAt",
    sortOrder: "desc",
  });

  const { data, isLoading, isError, refetch } = useGetInvoicesQuery(queryParams);
  const [cancelInvoice, { isLoading: isCancelling }] = useCancelInvoiceMutation();
  const [createPayment, { isLoading: isRecordingPayment }] = useCreatePaymentMutation();

  // Modals state
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState<Invoice | null>(null);

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  const handleOpenPayment = (inv: Invoice) => {
    setPaymentInvoice(inv);
    setPaymentAmount(inv.remainingAmount || 0);
    setPaymentMethod("cash");
    setPaymentRef("");
    setPaymentNotes("");
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;

    if (paymentAmount <= 0) {
      toast.error(t("invoices.errors.amountGreaterThanZero"));
      return;
    }

    try {
      await createPayment({
        invoice: paymentInvoice._id,
        amount: Number(paymentAmount),
        method: paymentMethod,
        transactionReference: paymentRef.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      }).unwrap();

      toast.success(t("invoices.success.paymentRecorded"));
      setPaymentInvoice(null);
      if (viewInvoice && viewInvoice._id === paymentInvoice._id) {
        setViewInvoice(null);
      }
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("invoices.errors.paymentFailed"));
    }
  };

  const handleCancelInvoice = async () => {
    if (!cancelInvoiceTarget) return;

    try {
      await cancelInvoice(cancelInvoiceTarget._id).unwrap();
      toast.success(t("invoices.success.invoiceCancelled"));
      setCancelInvoiceTarget(null);
      if (viewInvoice && viewInvoice._id === cancelInvoiceTarget._id) {
        setViewInvoice(null);
      }
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("invoices.errors.cancelFailed"));
    }
  };

  const columns: Column<Invoice>[] = [
    {
      key: "invoiceNumber",
      header: t("invoices.column.invoiceNumber"),
      render: (inv) => (
        <span className="font-mono text-xs font-bold text-ink">
          {inv.invoiceNumber || inv._id.slice(-6).toUpperCase()}
        </span>
      ),
    },
    {
      key: "issuedAt",
      header: t("invoices.column.issuedDate"),
      render: (inv) => (
        <span className="text-xs text-slate-dark">
          {new Date(inv.issuedAt || inv.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "patient",
      header: t("invoices.column.patient"),
      render: (inv) => {
        const p = typeof inv.patient === "object" && inv.patient ? inv.patient : null;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-ink text-xs">
              {p ? `${p.firstName} ${p.lastName}` : t("invoices.column.patientDefault")}
            </span>
            {p?.phone && (
              <span className="text-[11px] text-slate-muted">{p.phone}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "doctor",
      header: t("invoices.column.physician"),
      render: (inv) => {
        const doc = typeof inv.doctor === "object" && inv.doctor ? inv.doctor : null;
        const u = doc && typeof doc.user === "object" && doc.user ? doc.user : null;
        return (
          <span className="text-xs text-slate-dark">
            {u ? `Dr. ${u.lastName}` : t("invoices.column.physicianDefault")}
          </span>
        );
      },
    },
    {
      key: "total",
      header: t("invoices.column.total"),
      render: (inv) => (
        <span className="font-semibold text-ink text-xs">
          ${inv.total?.toFixed(2)}
        </span>
      ),
    },
    {
      key: "paidAmount",
      header: t("invoices.column.paid"),
      render: (inv) => (
        <span className="text-status-success font-medium text-xs">
          ${inv.paidAmount?.toFixed(2)}
        </span>
      ),
    },
    {
      key: "remainingAmount",
      header: t("invoices.column.balanceDue"),
      render: (inv) => (
        <span
          className={`font-semibold text-xs ${
            inv.remainingAmount > 0 ? "text-status-error" : "text-slate-muted"
          }`}
        >
          ${inv.remainingAmount?.toFixed(2)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      render: (inv) => <StatusBadge status={inv.status} size="sm" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (inv) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewInvoice(inv)}
            title={t("invoices.actions.viewDetails")}
          >
            <LuEye className="w-3.5 h-3.5" />
          </Button>

          {canManageBilling && inv.status !== "paid" && inv.status !== "cancelled" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenPayment(inv)}
              title={t("invoices.actions.recordPayment")}
              className="text-xs px-2 py-1"
            >
              {t("invoices.actions.pay")}
            </Button>
          )}

          {canManageBilling && inv.status !== "cancelled" && inv.paidAmount === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCancelInvoiceTarget(inv)}
              title={t("invoices.actions.cancelInvoice")}
              className="text-status-error hover:bg-status-error-bg"
            >
              <LuBan className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("invoices.title")}
        subtitle={t("invoices.subtitle")}
      />

      {/* Filter and Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-lg border border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-44">
            <Select
              value={queryParams.status || ""}
              onChange={(e) =>
                setQueryParams((prev) => ({
                  ...prev,
                  status: (e.target.value as InvoiceStatus) || undefined,
                  page: 1,
                }))
              }
              placeholder={t("invoices.allStatuses")}
              options={[
                { value: "", label: t("invoices.allStatuses") },
                { value: "unpaid", label: t("invoices.statusOptions.unpaid") },
                { value: "partially_paid", label: t("invoices.statusOptions.partiallyPaid") },
                { value: "paid", label: t("invoices.statusOptions.paid") },
                { value: "cancelled", label: t("invoices.statusOptions.cancelled") },
              ]}
            />
          </div>
        </div>

        <div className="text-xs text-slate-muted">
          {t("invoices.totalRecords")}: <strong className="text-ink">{data?.pagination?.total || 0}</strong>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle={t("invoices.emptyTitle")}
        emptyDescription={t("invoices.emptyDescription")}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
      />

      {/* Invoice Details Modal */}
      <Modal
        isOpen={Boolean(viewInvoice)}
        onClose={() => setViewInvoice(null)}
        title={`${t("invoices.modal.invoicePrefix")} ${viewInvoice?.invoiceNumber || viewInvoice?._id.slice(-6).toUpperCase()}`}
        subtitle={`${t("invoices.modal.issuedOn")} ${
          viewInvoice
            ? new Date(viewInvoice.issuedAt || viewInvoice.createdAt).toLocaleDateString()
            : ""
        }`}
        size="lg"
      >
        {viewInvoice && (
          <div className="flex flex-col gap-5">
            {/* Header / Parties Summary */}
            <div className="grid grid-cols-2 gap-4 p-3.5 bg-paper rounded-lg border border-border-subtle text-xs">
              <div>
                <span className="font-semibold text-slate-muted uppercase tracking-wider text-[10px]">
                  {t("invoices.modal.patientDetails")}
                </span>
                <p className="font-bold text-ink mt-0.5">
                  {typeof viewInvoice.patient === "object" && viewInvoice.patient
                    ? `${viewInvoice.patient.firstName} ${viewInvoice.patient.lastName}`
                    : t("invoices.modal.patientDefault")}
                </p>
                {typeof viewInvoice.patient === "object" && viewInvoice.patient?.phone && (
                  <p className="text-slate-muted">{viewInvoice.patient.phone}</p>
                )}
              </div>

              <div>
                <span className="font-semibold text-slate-muted uppercase tracking-wider text-[10px]">
                  {t("invoices.modal.attendingPhysician")}
                </span>
                <p className="font-bold text-ink mt-0.5">
                  {typeof viewInvoice.doctor === "object" &&
                  viewInvoice.doctor &&
                  typeof viewInvoice.doctor.user === "object" &&
                  viewInvoice.doctor.user
                    ? `Dr. ${viewInvoice.doctor.user.firstName} ${viewInvoice.doctor.user.lastName}`
                    : t("invoices.modal.physicianDefault")}
                </p>
                <div className="mt-1">
                  <StatusBadge status={viewInvoice.status} size="sm" />
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <span className="font-semibold text-ink text-xs uppercase tracking-wider">
                {t("invoices.modal.servicesAndProcedures")}
              </span>
              <div className="mt-2 border border-border-subtle rounded-md overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-paper border-b border-border-subtle text-slate-muted font-medium">
                    <tr>
                      <th className="py-2 px-3">{t("invoices.modal.description")}</th>
                      <th className="py-2 px-2 text-right">{t("invoices.modal.qty")}</th>
                      <th className="py-2 px-3 text-right">{t("invoices.modal.rate")}</th>
                      <th className="py-2 px-3 text-right">{t("invoices.modal.total")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {viewInvoice.items?.length > 0 ? (
                      viewInvoice.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-medium text-ink">{item.name}</td>
                          <td className="py-2 px-2 text-right text-slate-dark">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-dark">
                            ${item.price?.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-ink">
                            ${item.total?.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-3 px-3 text-center text-slate-muted">
                          {t("invoices.modal.standardConsultation")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="flex flex-col gap-1.5 self-end w-64 text-xs pt-2">
              <div className="flex justify-between text-slate-muted">
                <span>{t("invoices.modal.subtotal")}:</span>
                <span className="font-medium text-ink">
                  ${(viewInvoice.subtotal || viewInvoice.total)?.toFixed(2)}
                </span>
              </div>
              {viewInvoice.discount > 0 && (
                <div className="flex justify-between text-status-success">
                  <span>{t("invoices.modal.discount")}:</span>
                  <span>-${viewInvoice.discount.toFixed(2)}</span>
                </div>
              )}
              {viewInvoice.tax > 0 && (
                <div className="flex justify-between text-slate-muted">
                  <span>{t("invoices.modal.tax")}:</span>
                  <span>+${viewInvoice.tax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-ink text-sm border-t border-border-subtle pt-2">
                <span>{t("invoices.modal.totalAmount")}:</span>
                <span>${viewInvoice.total?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-status-success font-medium">
                <span>{t("invoices.modal.amountPaid")}:</span>
                <span>${viewInvoice.paidAmount?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-border-subtle">
                <span className="text-slate-muted">{t("invoices.modal.balanceDue")}:</span>
                <span
                  className={
                    viewInvoice.remainingAmount > 0
                      ? "text-status-error"
                      : "text-status-success"
                  }
                >
                  ${viewInvoice.remainingAmount?.toFixed(2)}
                </span>
              </div>
            </div>

            {viewInvoice.notes && (
              <div className="p-3 bg-paper rounded-md text-xs text-slate-muted">
                <span className="font-semibold text-ink">{t("invoices.modal.billingNotes")} </span>
                {viewInvoice.notes}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                leftIcon={<LuPrinter className="w-3.5 h-3.5" />}
              >
                {t("invoices.modal.printInvoice")}
              </Button>

              <div className="flex items-center gap-2">
                {viewInvoice.status !== "paid" && viewInvoice.status !== "cancelled" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      handleOpenPayment(viewInvoice);
                    }}
                    leftIcon={<LuCreditCard className="w-3.5 h-3.5" />}
                  >
                    {t("invoices.modal.recordPayment")}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setViewInvoice(null)}
                >
                  {t("common.close")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={Boolean(paymentInvoice)}
        onClose={() => setPaymentInvoice(null)}
        title={t("invoices.payment.title")}
        subtitle={`${t("invoices.payment.invoiceNumberPrefix")} ${paymentInvoice?.invoiceNumber || paymentInvoice?._id.slice(-6).toUpperCase()} • ${t("invoices.payment.remaining")} $${paymentInvoice?.remainingAmount?.toFixed(2)}`}
      >
        <form onSubmit={handleRecordPayment} className="flex flex-col gap-4">
          <Input
            label={t("invoices.payment.amountLabel")}
            type="number"
            step="0.01"
            min="0.01"
            max={paymentInvoice?.remainingAmount}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
            required
            helperText={`${t("invoices.payment.maxPayable")}: $${paymentInvoice?.remainingAmount?.toFixed(2)}`}
          />

          <Select
            label={t("invoices.payment.methodLabel")}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            options={[
              { value: "cash", label: t("invoices.payment.methods.cash") },
              { value: "card", label: t("invoices.payment.methods.card") },
              { value: "bank_transfer", label: t("invoices.payment.methods.bankTransfer") },
              { value: "online", label: t("invoices.payment.methods.online") },
              { value: "insurance", label: t("invoices.payment.methods.insurance") },
            ]}
          />

          <Input
            label={t("invoices.payment.referenceLabel")}
            placeholder={t("invoices.payment.referencePlaceholder")}
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
          />

          <Textarea
            label={t("invoices.payment.notesLabel")}
            placeholder={t("invoices.payment.notesPlaceholder")}
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            rows={2}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPaymentInvoice(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isRecordingPayment}
              leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
            >
              {t("invoices.payment.confirm")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Invoice Confirmation Modal */}
      <Modal
        isOpen={Boolean(cancelInvoiceTarget)}
        onClose={() => setCancelInvoiceTarget(null)}
        title={t("invoices.cancel.title")}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 bg-status-warning-bg border border-status-warning/20 rounded-lg text-xs text-status-warning">
            <LuTriangleAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-ink">{t("invoices.cancel.prompt")}</p>
              <p className="mt-1 text-slate-muted">
                {t("invoices.cancel.warning", {
                  invoiceNumber: cancelInvoiceTarget?.invoiceNumber || cancelInvoiceTarget?._id.slice(-6).toUpperCase(),
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCancelInvoiceTarget(null)}
            >
              {t("invoices.cancel.back")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isCancelling}
              onClick={handleCancelInvoice}
              leftIcon={<LuBan className="w-3.5 h-3.5" />}
            >
              {t("invoices.cancel.action")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
