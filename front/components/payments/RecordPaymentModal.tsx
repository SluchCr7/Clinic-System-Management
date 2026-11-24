"use client";

import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetPaymentMethodsQuery,
  useCreatePaymentMutation,
  useGetPaymentsQuery,
} from "@/services/api/paymentApi";
import type { Invoice } from "@/types/invoice";
import type { Payment, PaymentMethodItem } from "@/types/payment";
import {
  Modal,
  Button,
  Input,
  Textarea,
  toast,
  Skeleton,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import {
  LuBanknote,
  LuCreditCard,
  LuSmartphone,
  LuWallet,
  LuCircleCheck,
  LuHistory,
  LuUser,
} from "react-icons/lu";

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onPaymentSuccess?: (payment: Payment) => void;
}

interface PaymentFormInnerProps {
  invoice: Invoice;
  methods: PaymentMethodItem[];
  isLoadingMethods: boolean;
  onClose: () => void;
  onPaymentSuccess?: (payment: Payment) => void;
}

function PaymentFormInner({
  invoice,
  methods,
  isLoadingMethods,
  onClose,
  onPaymentSuccess,
}: PaymentFormInnerProps) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";

  const defaultMethod = useMemo(() => {
    return methods.find((m) => m.isDefault) || methods[0] || null;
  }, [methods]);

  const [selectedMethodId, setSelectedMethodId] = useState<string>(() => {
    return defaultMethod?._id || "";
  });

  const [paymentAmount, setPaymentAmount] = useState<number>(() => {
    return invoice.remainingAmount || 0;
  });

  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [receivedAmount, setReceivedAmount] = useState<number | "">("");
  const [notes, setNotes] = useState<string>("");
  const [justPaidSuccess, setJustPaidSuccess] = useState<boolean>(false);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  });

  const [createPayment, { isLoading: isRecording }] = useCreatePaymentMutation();

  const {
    data: paymentsData,
    isLoading: isLoadingPayments,
    refetch: refetchPayments,
  } = useGetPaymentsQuery(
    { invoice: invoice._id, limit: 100 },
    { skip: !invoice._id }
  );

  const activeMethodId = selectedMethodId || defaultMethod?._id || "";
  const selectedMethod = useMemo(() => {
    return methods.find((m) => m._id === activeMethodId) || defaultMethod;
  }, [methods, activeMethodId, defaultMethod]);

  const isCash = selectedMethod?.code === "cash";
  const requiresReference = Boolean(selectedMethod?.requiresReference);

  const handleSelectMethod = (method: PaymentMethodItem) => {
    setSelectedMethodId(method._id);
    if (!method.requiresReference) {
      setReferenceNumber("");
    }
    if (method.code !== "cash") {
      setReceivedAmount("");
    }
  };

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

  const changeDue = useMemo(() => {
    if (!isCash || typeof receivedAmount !== "number" || receivedAmount <= 0) {
      return null;
    }
    return Math.max(
      0,
      Math.round((receivedAmount - paymentAmount + Number.EPSILON) * 100) / 100
    );
  }, [isCash, receivedAmount, paymentAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod) return;

    if (paymentAmount <= 0) {
      toast.error(
        t("invoices.errors.amountGreaterThanZero", "يجب أن يكون مبلغ الدفع أكبر من 0")
      );
      return;
    }

    if (paymentAmount > invoice.remainingAmount) {
      toast.error(
        `${t("invoices.payment.maxPayable", "أقصى مبلغ مسموح به")}: $${invoice.remainingAmount.toFixed(2)}`
      );
      return;
    }

    if (requiresReference && !referenceNumber.trim()) {
      toast.error(
        t(
          "invoices.payment.referenceRequired",
          "رقم العملية / المرجع مطلوب لطريقة الدفع هذه"
        )
      );
      return;
    }

    try {
      const response = await createPayment({
        invoice: invoice._id,
        amount: Number(paymentAmount),
        paymentMethod: selectedMethod._id,
        method: selectedMethod.code,
        referenceNumber: referenceNumber.trim() || undefined,
        transactionReference: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey,
      }).unwrap();

      toast.success(
        t("invoices.success.paymentRecorded", "تم تسجيل الدفع بنجاح")
      );
      refetchPayments();

      if (onPaymentSuccess && response.data) {
        onPaymentSuccess(response.data);
      }

      const newRemaining = Math.max(
        0,
        Math.round((invoice.remainingAmount - paymentAmount + Number.EPSILON) * 100) / 100
      );

      if (newRemaining > 0) {
        setJustPaidSuccess(true);
        setPaymentAmount(newRemaining);
        setReceivedAmount("");
        setReferenceNumber("");
        setNotes("");
        const nextKey =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        setIdempotencyKey(nextKey);
      } else {
        onClose();
      }
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(
        extracted.message ||
          t("invoices.errors.paymentFailed", "فشل في تسجيل الدفع")
      );
    }
  };

  const previousPayments = paymentsData?.data || [];

  return (
    <div className="flex flex-col gap-5 text-xs">
      {/* Invoice Balance Summary Banner */}
      <div className="grid grid-cols-3 gap-3 p-3.5 bg-paper rounded-lg border border-border-subtle">
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-muted">
            {t("invoices.modal.totalAmount", "إجمالي المبلغ")}
          </span>
          <span className="font-bold text-sm text-ink font-mono">
            ${invoice.total?.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-muted">
            {t("invoices.modal.amountPaid", "المسدد حتى الآن")}
          </span>
          <span className="font-bold text-sm text-status-success font-mono">
            ${invoice.paidAmount?.toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-muted">
            {t("invoices.payment.remaining", "الرصيد المتبقي")}
          </span>
          <span className="font-bold text-base text-status-error font-mono">
            ${invoice.remainingAmount?.toFixed(2)}
          </span>
        </div>
      </div>

      {justPaidSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuCircleCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {t("invoices.success.paymentRecorded", "تم تسجيل الدفعة بنجاح!")}{" "}
              {invoice.remainingAmount > 0 && (
                <strong>
                  {t("invoices.payment.remaining", "المتبقي:")} $
                  {invoice.remainingAmount.toFixed(2)}
                </strong>
              )}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setJustPaidSuccess(false)}
          >
            {t("invoices.payment.addAnotherPayment", "تسجيل دفعة إضافية")}
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Payment Method Selector (Segmented Radio Cards) */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold text-slate-dark">
            {t("invoices.payment.methodLabel", "طريقة الدفع")} *
          </label>

          {isLoadingMethods ? (
            <div className="grid grid-cols-3 gap-2.5">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {methods.map((method) => {
                const isSelected = selectedMethod?._id === method._id;
                const displayName = isArabic ? method.nameAr : method.nameEn;

                return (
                  <button
                    key={method._id}
                    type="button"
                    onClick={() => handleSelectMethod(method)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-teal-primary bg-mint/50 ring-2 ring-teal-primary/30 shadow-xs"
                        : "border-border-subtle bg-surface hover:bg-paper/80"
                    }`}
                  >
                    <div className="p-2 rounded-md bg-paper border border-border-subtle shrink-0">
                      {getMethodIcon(method.code)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs text-ink truncate">
                        {displayName}
                      </span>
                      {method.isDefault && (
                        <span className="text-[10px] text-teal-dark font-medium">
                          {isArabic ? "الافتراضي" : "Default"}
                        </span>
                      )}
                      {method.requiresReference && !method.isDefault && (
                        <span className="text-[10px] text-slate-muted">
                          {isArabic ? "يتطلب مرجع" : "Ref. required"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment Amount Field */}
        <Input
          label={t("invoices.payment.amountLabel", "مبلغ الدفع ($)")}
          type="number"
          step="0.01"
          min="0.01"
          max={invoice.remainingAmount}
          value={paymentAmount || ""}
          onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
          required
          helperText={`${t("invoices.payment.maxPayable", "أقصى مبلغ مسموح به")}: $${
            invoice.remainingAmount?.toFixed(2) || "0.00"
          }`}
        />

        {/* Reference Number Field */}
        {requiresReference && (
          <Input
            label={`${t("payments.referenceNumber", "رقم العملية / المرجع")} *`}
            placeholder={t(
              "invoices.payment.referencePlaceholder",
              "مثل TXN-984214 أو رقم التحويل"
            )}
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            required
            helperText={t(
              "invoices.payment.referenceRequired",
              "رقم العملية / المرجع مطلوب لطريقة الدفع هذه"
            )}
          />
        )}

        {/* Cash Change Calculator */}
        {isCash && (
          <div className="p-3 bg-paper rounded-lg border border-border-subtle flex flex-col gap-2">
            <Input
              label={t(
                "invoices.payment.receivedAmountLabel",
                "المبلغ المستلم من المريض (اختياري)"
              )}
              type="number"
              step="0.01"
              min="0"
              placeholder={t(
                "invoices.payment.receivedAmountLabel",
                "المبلغ المستلم"
              )}
              value={receivedAmount}
              onChange={(e) => {
                const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                setReceivedAmount(val);
              }}
            />

            {typeof receivedAmount === "number" && receivedAmount > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-border-subtle text-xs">
                <span className="text-slate-dark font-medium">
                  {t("invoices.payment.changeDueLabel", "الباقي للمريض")}:
                </span>
                <span
                  className={`font-bold font-mono text-sm ${
                    receivedAmount >= paymentAmount
                      ? "text-status-success"
                      : "text-status-error"
                  }`}
                >
                  ${changeDue !== null ? changeDue.toFixed(2) : "0.00"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Notes Field */}
        <Textarea
          label={t("invoices.payment.notesLabel", "ملاحظات الدفع")}
          placeholder={t(
            "invoices.payment.notesPlaceholder",
            "ملاحظات إضافية على إيصال الدفع..."
          )}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isRecording}
          >
            {t("common.cancel", "إلغاء")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isRecording}
            leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
          >
            {t("invoices.payment.confirm", "تأكيد الدفع")}
          </Button>
        </div>
      </form>

      {/* Previous Payments History Section */}
      <div className="pt-3 border-t border-border-subtle flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-slate-dark font-semibold">
          <LuHistory className="w-3.5 h-3.5 text-teal-primary" />
          <span>{t("invoices.payment.previousPayments", "سجل دفعات الفاتورة")}</span>
          <span className="text-[11px] text-slate-muted">
            ({previousPayments.length})
          </span>
        </div>

        {isLoadingPayments ? (
          <Skeleton className="h-16" />
        ) : previousPayments.length > 0 ? (
          <div className="border border-border-subtle rounded-md overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper text-slate-muted border-b border-border-subtle">
                <tr>
                  <th className="py-2 px-3">{t("payments.paymentDate", "التاريخ")}</th>
                  <th className="py-2 px-3">{t("payments.paymentMethod", "الطريقة")}</th>
                  <th className="py-2 px-3">{t("payments.referenceNumber", "المرجع")}</th>
                  <th className="py-2 px-3">{t("invoices.payment.staffMember", "الموظف")}</th>
                  <th className="py-2 px-3 text-right">{t("payments.amountPaid", "المبلغ")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {previousPayments.map((p) => {
                  const staff =
                    typeof p.receivedBy === "object" && p.receivedBy
                      ? `${p.receivedBy.firstName} ${p.receivedBy.lastName}`
                      : typeof p.createdBy === "object" && p.createdBy
                      ? `${p.createdBy.firstName} ${p.createdBy.lastName}`
                      : "-";

                  const methodLabel =
                    typeof p.paymentMethod === "object" && p.paymentMethod
                      ? (isArabic ? p.paymentMethod.nameAr : p.paymentMethod.nameEn)
                      : t(`payments.methods.${p.method}`, p.method);

                  return (
                    <tr key={p._id} className="hover:bg-paper/40">
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-dark">
                        {new Date(p.paidAt || p.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 font-medium text-ink">
                        <span className="flex items-center gap-1">
                          {getMethodIcon(p.method)}
                          {methodLabel}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-muted text-[11px]">
                        {p.referenceNumber || p.transactionReference || "—"}
                      </td>
                      <td className="py-2 px-3 text-slate-muted text-[11px]">
                        <span className="flex items-center gap-1">
                          <LuUser className="w-3 h-3" />
                          {staff}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-status-success font-mono">
                        +${p.amount?.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-3 bg-paper rounded border border-border-subtle text-slate-muted text-center italic">
            {t("invoices.paymentsHistory.noPayments", "لم يتم تسجيل أي دفعات لهذه الفاتورة بعد.")}
          </p>
        )}
      </div>
    </div>
  );
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  invoice,
  onPaymentSuccess,
}: RecordPaymentModalProps) {
  const { t } = useTranslation();

  const { data: methodsData, isLoading: isLoadingMethods } =
    useGetPaymentMethodsQuery(undefined, { skip: !isOpen });

  const methods: PaymentMethodItem[] = useMemo(() => {
    return methodsData?.data || [];
  }, [methodsData]);

  if (!isOpen || !invoice) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("invoices.payment.title", "تسجيل تسوية الفاتورة")}
      subtitle={`${t("invoices.payment.invoiceNumberPrefix", "الفاتورة #")} ${
        invoice.invoiceNumber || invoice._id.slice(-6).toUpperCase()
      }`}
      size="lg"
    >
      <PaymentFormInner
        key={`${invoice._id}-${invoice.remainingAmount}`}
        invoice={invoice}
        methods={methods}
        isLoadingMethods={isLoadingMethods}
        onClose={onClose}
        onPaymentSuccess={onPaymentSuccess}
      />
    </Modal>
  );
}
