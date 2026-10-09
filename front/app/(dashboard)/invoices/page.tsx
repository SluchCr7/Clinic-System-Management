"use client";

import React, { useState } from "react";
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
import {
  LuReceipt,
  LuCreditCard,
  LuPrinter,
  LuBan,
  LuCircleCheck,
  LuTriangleAlert,
  LuEye,
} from "react-icons/lu";

export default function InvoicesPage() {
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
      toast.error("Payment amount must be greater than 0.");
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

      toast.success("Payment recorded successfully.");
      setPaymentInvoice(null);
      if (viewInvoice && viewInvoice._id === paymentInvoice._id) {
        setViewInvoice(null);
      }
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || "Failed to record payment.");
    }
  };

  const handleCancelInvoice = async () => {
    if (!cancelInvoiceTarget) return;

    try {
      await cancelInvoice(cancelInvoiceTarget._id).unwrap();
      toast.success("Invoice cancelled successfully.");
      setCancelInvoiceTarget(null);
      if (viewInvoice && viewInvoice._id === cancelInvoiceTarget._id) {
        setViewInvoice(null);
      }
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || "Failed to cancel invoice.");
    }
  };

  const columns: Column<Invoice>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice #",
      render: (inv) => (
        <span className="font-mono text-xs font-bold text-ink">
          {inv.invoiceNumber || inv._id.slice(-6).toUpperCase()}
        </span>
      ),
    },
    {
      key: "issuedAt",
      header: "Issued Date",
      render: (inv) => (
        <span className="text-xs text-slate-dark">
          {new Date(inv.issuedAt || inv.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      render: (inv) => {
        const p = typeof inv.patient === "object" && inv.patient ? inv.patient : null;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-ink text-xs">
              {p ? `${p.firstName} ${p.lastName}` : "Patient"}
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
      header: "Physician",
      render: (inv) => {
        const doc = typeof inv.doctor === "object" && inv.doctor ? inv.doctor : null;
        const u = doc && typeof doc.user === "object" && doc.user ? doc.user : null;
        return (
          <span className="text-xs text-slate-dark">
            {u ? `Dr. ${u.lastName}` : "Physician"}
          </span>
        );
      },
    },
    {
      key: "total",
      header: "Total",
      render: (inv) => (
        <span className="font-semibold text-ink text-xs">
          ${inv.total?.toFixed(2)}
        </span>
      ),
    },
    {
      key: "paidAmount",
      header: "Paid",
      render: (inv) => (
        <span className="text-status-success font-medium text-xs">
          ${inv.paidAmount?.toFixed(2)}
        </span>
      ),
    },
    {
      key: "remainingAmount",
      header: "Balance Due",
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
      header: "Status",
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
            title="View Invoice Details"
          >
            <LuEye className="w-3.5 h-3.5" />
          </Button>

          {inv.status !== "paid" && inv.status !== "cancelled" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenPayment(inv)}
              title="Record Payment"
              className="text-xs px-2 py-1"
            >
              Pay
            </Button>
          )}

          {inv.status !== "cancelled" && inv.paidAmount === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCancelInvoiceTarget(inv)}
              title="Cancel Invoice"
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
        title="Invoices & Billing"
        subtitle="Manage patient billing statements, payment balances, and financial records"
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
              placeholder="All Statuses"
              options={[
                { value: "", label: "All Statuses" },
                { value: "unpaid", label: "Unpaid" },
                { value: "partially_paid", label: "Partially Paid" },
                { value: "paid", label: "Paid" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
          </div>
        </div>

        <div className="text-xs text-slate-muted">
          Total Records: <strong className="text-ink">{data?.pagination?.total || 0}</strong>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle="No invoices found"
        emptyDescription="There are no billing invoices matching your selected filter."
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
      />

      {/* Invoice Details Modal */}
      <Modal
        isOpen={Boolean(viewInvoice)}
        onClose={() => setViewInvoice(null)}
        title={`Invoice ${viewInvoice?.invoiceNumber || viewInvoice?._id.slice(-6).toUpperCase()}`}
        subtitle={`Issued on ${
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
                  Patient Details
                </span>
                <p className="font-bold text-ink mt-0.5">
                  {typeof viewInvoice.patient === "object" && viewInvoice.patient
                    ? `${viewInvoice.patient.firstName} ${viewInvoice.patient.lastName}`
                    : "Patient"}
                </p>
                {typeof viewInvoice.patient === "object" && viewInvoice.patient?.phone && (
                  <p className="text-slate-muted">{viewInvoice.patient.phone}</p>
                )}
              </div>

              <div>
                <span className="font-semibold text-slate-muted uppercase tracking-wider text-[10px]">
                  Attending Physician
                </span>
                <p className="font-bold text-ink mt-0.5">
                  {typeof viewInvoice.doctor === "object" &&
                  viewInvoice.doctor &&
                  typeof viewInvoice.doctor.user === "object" &&
                  viewInvoice.doctor.user
                    ? `Dr. ${viewInvoice.doctor.user.firstName} ${viewInvoice.doctor.user.lastName}`
                    : "Physician"}
                </p>
                <div className="mt-1">
                  <StatusBadge status={viewInvoice.status} size="sm" />
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <span className="font-semibold text-ink text-xs uppercase tracking-wider">
                Services & Procedures
              </span>
              <div className="mt-2 border border-border-subtle rounded-md overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-paper border-b border-border-subtle text-slate-muted font-medium">
                    <tr>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-2 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3 text-right">Total</th>
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
                          Standard Clinical Consultation
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
                <span>Subtotal:</span>
                <span className="font-medium text-ink">
                  ${(viewInvoice.subtotal || viewInvoice.total)?.toFixed(2)}
                </span>
              </div>
              {viewInvoice.discount > 0 && (
                <div className="flex justify-between text-status-success">
                  <span>Discount:</span>
                  <span>-${viewInvoice.discount.toFixed(2)}</span>
                </div>
              )}
              {viewInvoice.tax > 0 && (
                <div className="flex justify-between text-slate-muted">
                  <span>Tax:</span>
                  <span>+${viewInvoice.tax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-ink text-sm border-t border-border-subtle pt-2">
                <span>Total Amount:</span>
                <span>${viewInvoice.total?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-status-success font-medium">
                <span>Amount Paid:</span>
                <span>${viewInvoice.paidAmount?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-border-subtle">
                <span className="text-slate-muted">Balance Due:</span>
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
                <span className="font-semibold text-ink">Billing Notes: </span>
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
                Print Invoice
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
                    Record Payment
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setViewInvoice(null)}
                >
                  Close
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
        title="Record Invoice Settlement"
        subtitle={`Invoice #${paymentInvoice?.invoiceNumber || paymentInvoice?._id.slice(-6).toUpperCase()} • Remaining: $${paymentInvoice?.remainingAmount?.toFixed(2)}`}
      >
        <form onSubmit={handleRecordPayment} className="flex flex-col gap-4">
          <Input
            label="Payment Amount ($)"
            type="number"
            step="0.01"
            min="0.01"
            max={paymentInvoice?.remainingAmount}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
            required
            helperText={`Maximum payable: $${paymentInvoice?.remainingAmount?.toFixed(2)}`}
          />

          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            options={[
              { value: "cash", label: "Cash" },
              { value: "card", label: "Credit / Debit Card" },
              { value: "bank_transfer", label: "Bank Transfer" },
              { value: "online", label: "Online Gateway" },
              { value: "insurance", label: "Medical Insurance" },
            ]}
          />

          <Input
            label="Transaction Reference / Cheque #"
            placeholder="e.g. TXN-984214 or Auth Code"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
          />

          <Textarea
            label="Payment Notes"
            placeholder="Additional comments or payment receipt remarks..."
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
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isRecordingPayment}
              leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
            >
              Confirm Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Invoice Confirmation Modal */}
      <Modal
        isOpen={Boolean(cancelInvoiceTarget)}
        onClose={() => setCancelInvoiceTarget(null)}
        title="Cancel Invoice Confirmation"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 bg-status-warning-bg border border-status-warning/20 rounded-lg text-xs text-status-warning">
            <LuTriangleAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-ink">Are you sure you want to cancel this invoice?</p>
              <p className="mt-1 text-slate-muted">
                Invoice #{cancelInvoiceTarget?.invoiceNumber || cancelInvoiceTarget?._id.slice(-6).toUpperCase()} will be marked as cancelled and cannot be collected.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCancelInvoiceTarget(null)}
            >
              Back
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isCancelling}
              onClick={handleCancelInvoice}
              leftIcon={<LuBan className="w-3.5 h-3.5" />}
            >
              Cancel Invoice
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
