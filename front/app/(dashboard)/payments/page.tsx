"use client";

import React, { useState } from "react";
import { useGetPaymentsQuery } from "@/services/api/paymentApi";
import type { Payment, PaymentQueryParams, PaymentMethod } from "@/types/payment";
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
} from "react-icons/lu";

export default function PaymentsPage() {
  const [queryParams, setQueryParams] = useState<PaymentQueryParams>({
    page: 1,
    limit: 10,
    method: undefined,
    sortBy: "paidAt",
    sortOrder: "desc",
  });

  const { data, isLoading, isError, refetch } = useGetPaymentsQuery(queryParams);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);

  const getMethodBadge = (method: PaymentMethod) => {
    switch (method) {
      case "cash":
        return (
          <Badge variant="teal" size="sm" className="gap-1">
            <LuBanknote className="w-3 h-3" /> Cash
          </Badge>
        );
      case "card":
        return (
          <Badge variant="info" size="sm" className="gap-1">
            <LuCreditCard className="w-3 h-3" /> Card
          </Badge>
        );
      case "bank_transfer":
        return (
          <Badge variant="neutral" size="sm" className="gap-1">
            <LuBuilding2 className="w-3 h-3" /> Bank Transfer
          </Badge>
        );
      case "online":
        return (
          <Badge variant="teal" size="sm" className="gap-1">
            <LuGlobe className="w-3 h-3" /> Online
          </Badge>
        );
      case "insurance":
        return (
          <Badge variant="warning" size="sm" className="gap-1">
            <LuShield className="w-3 h-3" /> Insurance
          </Badge>
        );
      default:
        return <Badge variant="neutral" size="sm">{method}</Badge>;
    }
  };

  const columns: Column<Payment>[] = [
    {
      key: "paidAt",
      header: "Payment Date",
      render: (p) => (
        <span className="text-xs font-mono text-ink">
          {new Date(p.paidAt || p.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "invoice",
      header: "Invoice Reference",
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
      header: "Patient",
      render: (p) => {
        const pt = typeof p.patient === "object" && p.patient ? p.patient : null;
        return (
          <span className="font-medium text-ink text-xs">
            {pt ? `${pt.firstName} ${pt.lastName}` : "Patient"}
          </span>
        );
      },
    },
    {
      key: "method",
      header: "Payment Method",
      render: (p) => getMethodBadge(p.method),
    },
    {
      key: "transactionReference",
      header: "Reference #",
      render: (p) => (
        <span className="font-mono text-xs text-slate-muted">
          {p.transactionReference || "—"}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount Paid",
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
          Receipt
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Payment Transactions"
        subtitle="Historical financial receipts, settling methods, and transaction vouchers"
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
                  method: (e.target.value as PaymentMethod) || undefined,
                  page: 1,
                }))
              }
              placeholder="All Payment Methods"
              options={[
                { value: "", label: "All Payment Methods" },
                { value: "cash", label: "Cash" },
                { value: "card", label: "Card" },
                { value: "bank_transfer", label: "Bank Transfer" },
                { value: "online", label: "Online Gateway" },
                { value: "insurance", label: "Insurance" },
              ]}
            />
          </div>
        </div>

        <div className="text-xs text-slate-muted">
          Total Transactions: <strong className="text-ink">{data?.pagination?.total || 0}</strong>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyTitle="No payment records found"
        emptyDescription="There are no settlement receipts recorded matching this criteria."
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
      />

      {/* Printable Receipt Voucher Modal */}
      <Modal
        isOpen={Boolean(receiptPayment)}
        onClose={() => setReceiptPayment(null)}
        title="Payment Receipt Voucher"
        subtitle={`Voucher ID: ${receiptPayment?._id.slice(-8).toUpperCase()}`}
      >
        {receiptPayment && (
          <div className="flex flex-col gap-4 text-xs">
            {/* Clinical Brand Receipt Header */}
            <div className="text-center pb-3 border-b border-border-subtle">
              <h3 className="font-bold text-base text-ink">AEGIS CLINICAL SUITE</h3>
              <p className="text-slate-muted text-[11px]">Official Payment Settlement Receipt</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-paper rounded-lg">
              <div>
                <span className="text-[10px] uppercase text-slate-muted font-semibold">Date & Time:</span>
                <p className="font-medium text-ink">
                  {new Date(receiptPayment.paidAt || receiptPayment.createdAt).toLocaleString()}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase text-slate-muted font-semibold">Invoice Ref:</span>
                <p className="font-mono font-medium text-teal-dark">
                  #{typeof receiptPayment.invoice === "object" && receiptPayment.invoice
                    ? receiptPayment.invoice.invoiceNumber
                    : (typeof receiptPayment.invoice === "string" ? receiptPayment.invoice.slice(-6).toUpperCase() : "-")}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase text-slate-muted font-semibold">Patient:</span>
                <p className="font-semibold text-ink">
                  {typeof receiptPayment.patient === "object" && receiptPayment.patient
                    ? `${receiptPayment.patient.firstName} ${receiptPayment.patient.lastName}`
                    : "Patient"}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase text-slate-muted font-semibold">Payment Method:</span>
                <div className="mt-0.5">{getMethodBadge(receiptPayment.method)}</div>
              </div>

              {receiptPayment.transactionReference && (
                <div className="col-span-2">
                  <span className="text-[10px] uppercase text-slate-muted font-semibold">Transaction Reference:</span>
                  <p className="font-mono text-ink">{receiptPayment.transactionReference}</p>
                </div>
              )}
            </div>

            {/* Total Paid Display */}
            <div className="flex items-center justify-between p-3.5 bg-mint/50 border border-teal-primary/20 rounded-lg">
              <span className="font-bold text-ink uppercase tracking-wider text-xs">Amount Collected</span>
              <span className="font-bold text-xl text-teal-dark">
                ${receiptPayment.amount?.toFixed(2)}
              </span>
            </div>

            {receiptPayment.notes && (
              <div className="p-2.5 bg-paper rounded text-slate-muted text-xs">
                <span className="font-semibold text-ink">Remarks: </span>
                {receiptPayment.notes}
              </div>
            )}

            {/* Footer / Signature line */}
            <div className="pt-4 border-t border-dashed border-border-subtle flex justify-between items-end text-[11px] text-slate-muted">
              <div>
                <p>Status: <span className="text-status-success font-semibold">Settled & Verified</span></p>
                <p className="text-[10px]">Thank you for your visit.</p>
              </div>
              <div className="text-right">
                <div className="w-32 border-b border-border-subtle mb-1"></div>
                <span>Authorized Cashier</span>
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
                Print Voucher
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setReceiptPayment(null)}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
