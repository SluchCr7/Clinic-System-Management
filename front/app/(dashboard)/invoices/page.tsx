"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetInvoicesQuery,
  useCreateInvoiceMutation,
  useCancelInvoiceMutation,
  useGetEligibleVisitsQuery,
} from "@/services/api/invoiceApi";
import {
  useGetPaymentsQuery,
} from "@/services/api/paymentApi";
import { useGetPerformedServicesQuery } from "@/services/api/performedServiceApi";
import { useGetMedicalServicesQuery } from "@/services/api/medicalServiceApi";
import type { Invoice, InvoiceQueryParams, InvoiceStatus } from "@/types/invoice";
import type { PerformedService } from "@/types/performedService";
import { RecordPaymentModal } from "@/components/payments/RecordPaymentModal";
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
  LuPlus,
  LuHistory,
} from "react-icons/lu";

const isConsultationPerformedService = (service: PerformedService) => {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z]/g, "");
  const name = normalize(service.serviceName);
  const code = normalize(service.serviceCode);

  return (
    ["consultation", "consultationfee", "clinicalconsultation"].includes(name) ||
    ["consult", "consultation", "consultationfee"].includes(code)
  );
};

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export default function InvoicesPage() {
  const { t, i18n } = useTranslation();
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
  const [createInvoice, { isLoading: isCreatingInvoice }] = useCreateInvoiceMutation();
  const [cancelInvoice, { isLoading: isCancelling }] = useCancelInvoiceMutation();

  // Modals state
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState<Invoice | null>(null);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [eligibleVisitsPage, setEligibleVisitsPage] = useState(1);

  // Create Invoice Form State
  const [selectedVisitId, setSelectedVisitId] = useState<string>("");
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [invoiceTax, setInvoiceTax] = useState<number>(0);
  const [invoiceNotes, setInvoiceNotes] = useState<string>("");

  // Services attached to the newly created invoice
  const [selectedServices, setSelectedServices] = useState<
    Array<{
      serviceId: string;
      name: string;
      code: string;
      category?: string;
      price: number;
      quantity: number;
    }>
  >([]);
  const [addingServiceId, setAddingServiceId] = useState<string>("");

  // Fetch Payment History for the currently viewed invoice
  const { data: invoicePaymentsData } = useGetPaymentsQuery(
    viewInvoice?._id ? { invoice: viewInvoice._id, limit: 100 } : undefined,
    { skip: !viewInvoice?._id }
  );

  // Fetch Visits eligible for invoicing
  const {
    data: eligibleVisitsData,
    isLoading: isLoadingEligibleVisits,
    isError: isEligibleVisitsError,
    refetch: refetchEligibleVisits,
  } = useGetEligibleVisitsQuery(
    isCreateInvoiceOpen ? { page: eligibleVisitsPage, limit: 50 } : undefined,
    { skip: !isCreateInvoiceOpen }
  );

  const {
    data: visitServicesData,
    isLoading: isLoadingVisitServices,
    isError: isVisitServicesError,
  } = useGetPerformedServicesQuery(
    selectedVisitId ? { visit: selectedVisitId, limit: 100 } : undefined,
    { skip: !selectedVisitId }
  );

  const selectedVisit = eligibleVisitsData?.data.find(
    (visit) => visit._id === selectedVisitId
  );
  const selectedVisitDoctor =
    selectedVisit && typeof selectedVisit.doctor === "object"
      ? selectedVisit.doctor
      : null;
  const consultationFee = selectedVisitDoctor?.consultationFee;
  const hasValidConsultationFee =
    typeof consultationFee === "number" &&
    Number.isFinite(consultationFee) &&
    consultationFee >= 0;

  const selectedVisitDoctorUser =
    selectedVisitDoctor && typeof selectedVisitDoctor.user === "object" && selectedVisitDoctor.user
      ? selectedVisitDoctor.user
      : null;
  const selectedDoctorUserId =
    selectedVisitDoctorUser?._id ||
    (typeof selectedVisitDoctor?.user === "string" ? selectedVisitDoctor.user : undefined);

  // Doctor's active medical services catalog
  const { data: doctorCatalogData } = useGetMedicalServicesQuery(
    selectedDoctorUserId
      ? { doctor: selectedDoctorUserId, isActive: true, limit: 100 }
      : { isActive: true, limit: 100 },
    { skip: !selectedVisitId }
  );

  // Pre-populate services from visit's recorded performed services
  useEffect(() => {
    if (visitServicesData?.data && visitServicesData.data.length > 0) {
      const initial = visitServicesData.data
        .filter((s) => !isConsultationPerformedService(s))
        .map((s) => ({
          serviceId: (typeof s.service === "object" && s.service ? (s.service as { _id: string })._id : s.service) as string,
          name: s.serviceName,
          code: s.serviceCode,
          category: s.category || "General",
          price: s.price,
          quantity: s.quantity || 1,
        }));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedServices(initial);
    } else {
      setSelectedServices([]);
    }
  }, [visitServicesData]);

  const handleAddServiceToInvoice = (serviceId: string) => {
    if (!serviceId) return;
    const svc = doctorCatalogData?.data?.find((s) => s._id === serviceId);
    if (!svc) return;

    setSelectedServices((prev) => {
      const idx = prev.findIndex((s) => s.serviceId === serviceId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          serviceId: svc._id,
          name: svc.name,
          code: svc.code,
          category: svc.category,
          price: svc.price,
          quantity: 1,
        },
      ];
    });
    setAddingServiceId("");
  };

  const handleRemoveServiceFromInvoice = (index: number) => {
    setSelectedServices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateServiceQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;
    setSelectedServices((prev) => {
      const copy = [...prev];
      copy[index].quantity = quantity;
      return copy;
    });
  };

  // Live Subtotal & Totals Calculation
  const servicesSubtotal = roundMoney(
    selectedServices.reduce(
      (acc, service) => acc + roundMoney(service.price * service.quantity),
      0
    )
  );
  const selectedVisitSubtotal = roundMoney(
    (hasValidConsultationFee ? consultationFee : 0) + servicesSubtotal
  );
  const selectedVisitCalculatedTotal = Math.max(
    0,
    roundMoney(selectedVisitSubtotal - invoiceDiscount + invoiceTax)
  );

  const handleOpenCreateInvoice = () => {
    setSelectedVisitId("");
    setSelectedServices([]);
    setAddingServiceId("");
    setInvoiceDiscount(0);
    setInvoiceTax(0);
    setInvoiceNotes("");
    setEligibleVisitsPage(1);
    setIsCreateInvoiceOpen(true);
  };

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisitId) {
      toast.error(t("invoices.create.selectVisit"));
      return;
    }
    if (!hasValidConsultationFee) {
      toast.error(t("invoices.create.consultationUnavailable"));
      return;
    }
    if (invoiceDiscount > selectedVisitSubtotal) {
      toast.error(t("invoices.modal.discount") + " cannot exceed subtotal.");
      return;
    }

    try {
      const result = await createInvoice({
        visit: selectedVisitId,
        services: selectedServices.map((s) => ({
          serviceId: s.serviceId,
          quantity: s.quantity,
        })),
        discount: Number(invoiceDiscount) || 0,
        tax: Number(invoiceTax) || 0,
        notes: invoiceNotes.trim() || undefined,
      }).unwrap();

      toast.success(t("invoices.create.success"));
      setIsCreateInvoiceOpen(false);
      setSelectedVisitId("");
      setSelectedServices([]);
      setViewInvoice(result.data);
    } catch (err) {
      const extracted = extractApiError(err);
      toast.error(extracted.message || t("invoices.create.error"));
    }
  };

  const handleOpenPayment = (inv: Invoice) => {
    setPaymentInvoice(inv);
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
        actions={
          canManageBilling ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateInvoice}
              leftIcon={<LuPlus className="w-4 h-4" />}
            >
              {t("invoices.actions.createInvoice")}
            </Button>
          ) : undefined
        }
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
                          <td className="py-2 px-3 font-medium text-ink">
                            {item.type === "consultation"
                              ? t("invoices.modal.standardConsultation")
                              : item.serviceName ||
                                (item as unknown as { name?: string }).name}
                            {item.type !== "consultation" && item.serviceCode && (
                              <span className="text-[10px] text-slate-muted font-mono ml-1.5">
                                ({item.serviceCode})
                              </span>
                            )}
                            {item.type !== "consultation" && item.discount > 0 && (
                              <span className="block text-[10px] font-normal text-status-success">
                                {t("invoices.modal.discount")}: -${item.discount.toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-dark">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-dark">
                            ${(item.unitPrice ?? (item as unknown as { price?: number }).price)?.toFixed(2)}
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

            {/* Payments History Section */}
            <div className="border-t border-border-subtle pt-3">
              <div className="flex items-center gap-2 mb-2">
                <LuHistory className="w-4 h-4 text-teal-primary" />
                <span className="font-semibold text-ink text-xs uppercase tracking-wider">
                  {t("invoices.paymentsHistory.title")}
                </span>
              </div>
              {invoicePaymentsData?.data && invoicePaymentsData.data.length > 0 ? (
                <div className="border border-border-subtle rounded-md overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-paper border-b border-border-subtle text-slate-muted font-medium">
                      <tr>
                        <th className="py-2 px-3">{t("invoices.paymentsHistory.date")}</th>
                        <th className="py-2 px-3">{t("invoices.paymentsHistory.method")}</th>
                        <th className="py-2 px-3">{t("invoices.paymentsHistory.reference")}</th>
                        <th className="py-2 px-3 text-right">{t("invoices.paymentsHistory.amount")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {invoicePaymentsData.data.map((p) => {
                        const methodLabel =
                          typeof p.paymentMethod === "object" && p.paymentMethod
                            ? (i18n.language === "ar"
                                ? p.paymentMethod.nameAr
                                : p.paymentMethod.nameEn)
                            : t(`payments.methods.${p.method}`, p.method.replace("_", " "));
                        const ref = p.referenceNumber || p.transactionReference || "—";
                        return (
                          <tr key={p._id}>
                            <td className="py-2 px-3 text-slate-dark font-mono text-[11px]">
                              {new Date(p.paidAt || p.createdAt).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 capitalize font-medium text-ink">
                              {methodLabel}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-muted text-[11px]">
                              {ref}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-status-success font-mono">
                              +${p.amount?.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-muted italic p-2 bg-paper rounded border border-border-subtle">
                  {t("invoices.paymentsHistory.noPayments")}
                </p>
              )}
            </div>

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
                      if (canManageBilling) {
                        handleOpenPayment(viewInvoice);
                      }
                    }}
                    leftIcon={<LuCreditCard className="w-3.5 h-3.5" />}
                    disabled={!canManageBilling}
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

      {/* Create Invoice Modal */}
      <Modal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        title={t("invoices.create.title")}
        subtitle={t("invoices.create.subtitle")}
        size="lg"
      >
        <form onSubmit={handleCreateInvoiceSubmit} className="flex flex-col gap-4 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-slate-dark block mb-1">
              {t("invoices.create.selectVisit")} *
            </label>
            <Select
              value={selectedVisitId}
              onChange={(e) => {
                setSelectedVisitId(e.target.value);
                setInvoiceDiscount(0);
              }}
              placeholder={t("invoices.create.visitPlaceholder")}
              options={
                eligibleVisitsData?.data?.map((v) => {
                  const pat = typeof v.patient === "object" && v.patient ? v.patient : null;
                  const doc = typeof v.doctor === "object" && v.doctor ? v.doctor : null;
                  const docUser = doc && typeof doc.user === "object" && doc.user ? doc.user : null;
                  const patientName = pat ? `${pat.firstName} ${pat.lastName}` : "Patient";
                  const docName = docUser ? `Dr. ${docUser.lastName}` : "Doctor";
                  return {
                    value: v._id,
                    label: `${patientName} (${docName}) — ${new Date(v.createdAt).toLocaleDateString()}`,
                  };
                }) || []
              }
            />
            {isLoadingEligibleVisits && (
              <p className="mt-1 text-slate-muted">
                {t("invoices.create.loadingVisits")}
              </p>
            )}
            {isEligibleVisitsError && (
              <div className="mt-1 flex items-center gap-2 text-status-error">
                <span>{t("invoices.create.visitsError")}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={refetchEligibleVisits}
                >
                  {t("invoices.create.retry")}
                </Button>
              </div>
            )}
            {!isLoadingEligibleVisits &&
              !isEligibleVisitsError &&
              eligibleVisitsData?.pagination.total === 0 && (
                <p className="mt-1 text-slate-muted">
                  {t("invoices.create.noEligibleVisits")}
                </p>
              )}
            {eligibleVisitsData?.pagination.pages &&
              eligibleVisitsData.pagination.pages > 1 && (
                <div className="mt-2 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!eligibleVisitsData.pagination.hasPrevPage}
                    onClick={() => {
                      setSelectedVisitId("");
                      setEligibleVisitsPage((page) => page - 1);
                    }}
                  >
                    {t("invoices.create.previousVisits")}
                  </Button>
                  <span className="text-slate-muted">
                    {eligibleVisitsData.pagination.page} / {eligibleVisitsData.pagination.pages}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!eligibleVisitsData.pagination.hasNextPage}
                    onClick={() => {
                      setSelectedVisitId("");
                      setEligibleVisitsPage((page) => page + 1);
                    }}
                  >
                    {t("invoices.create.nextVisits")}
                  </Button>
                </div>
              )}
          </div>

          {selectedVisitId && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between gap-4 rounded-md border border-border-subtle bg-paper p-3">
                <div>
                  <p className="font-semibold text-ink">
                    {selectedVisit && typeof selectedVisit.patient === "object"
                      ? `${selectedVisit.patient.firstName} ${selectedVisit.patient.lastName}`
                      : t("invoices.modal.patientDefault")}
                  </p>
                  <p className="text-slate-muted">
                    {selectedVisitDoctor &&
                    typeof selectedVisitDoctor.user === "object"
                      ? `Dr. ${selectedVisitDoctor.user.firstName} ${selectedVisitDoctor.user.lastName}`
                      : t("invoices.modal.physicianDefault")}
                  </p>
                </div>
              </div>
              {!hasValidConsultationFee && (
                <p className="text-xs text-status-error">
                  {t("invoices.create.consultationUnavailable")}
                </p>
              )}
              {/* Services Selector and List */}
              <div className="flex flex-col gap-2 pt-1 border-t border-border-subtle">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink text-xs uppercase tracking-wider">
                    الخدمات الطبية الإضافية (اختياري)
                  </span>
                  <span className="text-[11px] text-slate-muted">
                    {selectedServices.length} خدمة محددة
                  </span>
                </div>

                {/* Add Service Picker */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      value={addingServiceId}
                      onChange={(e) => setAddingServiceId(e.target.value)}
                      placeholder="اختر خدمة من كتالوج الطبيب لإضافتها..."
                      options={[
                        { value: "", label: "-- اختر خدمة طبية من الكتالوج --" },
                        ...(doctorCatalogData?.data?.map((s) => ({
                          value: s._id,
                          label: `${s.name} (${s.code}) — ${s.price} ج.م [${s.category}]`,
                        })) || []),
                      ]}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!addingServiceId}
                    onClick={() => handleAddServiceToInvoice(addingServiceId)}
                    leftIcon={<LuPlus className="w-3.5 h-3.5" />}
                  >
                    إضافة
                  </Button>
                </div>

                {/* Selected Services Table */}
                {selectedServices.length > 0 ? (
                  <div className="border border-border-subtle rounded-md overflow-hidden">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-paper border-b border-border-subtle text-slate-muted font-medium">
                        <tr>
                          <th className="py-2 px-3">الخدمة والكود</th>
                          <th className="py-2 px-2 text-center w-24">الكمية</th>
                          <th className="py-2 px-3 text-right">السعر</th>
                          <th className="py-2 px-3 text-right">الإجمالي</th>
                          <th className="py-2 px-2 text-center w-10">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {selectedServices.map((s, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-medium text-ink">
                              <div>{s.name}</div>
                              <div className="text-[10px] text-slate-muted font-mono flex items-center gap-1.5">
                                <span>{s.code}</span>
                                {s.category && <span>• {s.category}</span>}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateServiceQuantity(idx, s.quantity - 1)}
                                  disabled={s.quantity <= 1}
                                  className="w-5 h-5 rounded bg-surface border border-border-subtle text-ink flex items-center justify-center hover:bg-paper disabled:opacity-40"
                                >
                                  -
                                </button>
                                <span className="font-mono font-bold w-6 text-center text-xs">
                                  {s.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateServiceQuantity(idx, s.quantity + 1)}
                                  className="w-5 h-5 rounded bg-surface border border-border-subtle text-ink flex items-center justify-center hover:bg-paper"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-dark">
                              {s.price} ج.م
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-ink font-mono">
                              {(s.price * s.quantity).toFixed(2)} ج.م
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveServiceFromInvoice(idx)}
                                className="text-status-error hover:bg-status-error-bg p-1 rounded"
                                title="إزالة الخدمة"
                              >
                                <LuBan className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-muted p-2.5 bg-paper rounded-md border border-border-subtle text-center">
                    لم تتم إضافة أي خدمات إضافية (سيتم احتساب رسم الكشف الأساسي فقط).
                  </p>
                )}
              </div>

              {/* Price Breakdown Preview */}
              <div className="flex flex-col gap-1.5 p-3 bg-paper rounded-lg border border-border-subtle text-xs">
                <div className="flex justify-between text-slate-muted">
                  <span>سعر الكشف (الرسم الأساسي للطبيب):</span>
                  <span className="font-mono font-medium text-ink">
                    {hasValidConsultationFee ? `${consultationFee.toFixed(2)} ج.م` : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-muted">
                  <span>إجمالي الخدمات الطبية:</span>
                  <span className="font-mono font-medium text-ink">
                    {servicesSubtotal.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-slate-dark pt-1 border-t border-border-subtle font-semibold">
                  <span>المجموع الفرعي (الكشف + الخدمات):</span>
                  <span className="font-mono text-ink">
                    {selectedVisitSubtotal.toFixed(2)} ج.م
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Input
                  label={t("invoices.create.discountLabel")}
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedVisitSubtotal}
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(parseFloat(e.target.value) || 0)}
                />
                <Input
                  label={t("invoices.create.taxLabel")}
                  type="number"
                  step="0.01"
                  min="0"
                  value={invoiceTax}
                  onChange={(e) => setInvoiceTax(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Preview Totals */}
              <div className="flex flex-col gap-1 p-3 bg-paper rounded-lg border border-border-subtle text-xs">
                <div className="flex justify-between text-slate-muted">
                  <span>{t("invoices.create.subtotal")}:</span>
                  <span className="font-semibold text-ink font-mono">${selectedVisitSubtotal.toFixed(2)}</span>
                </div>
                {invoiceDiscount > 0 && (
                  <div className="flex justify-between text-status-success">
                    <span>{t("invoices.modal.discount")}:</span>
                    <span className="font-mono">-${invoiceDiscount.toFixed(2)}</span>
                  </div>
                )}
                {invoiceTax > 0 && (
                  <div className="flex justify-between text-slate-muted">
                    <span>{t("invoices.modal.tax")}:</span>
                    <span className="font-mono">+${invoiceTax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-ink text-sm pt-1 border-t border-border-subtle">
                  <span>{t("invoices.create.totalPreview")}:</span>
                  <span className="text-teal-primary font-mono">${selectedVisitCalculatedTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <Textarea
            label={t("invoices.create.notesLabel")}
            placeholder={t("invoices.create.notesPlaceholder")}
            value={invoiceNotes}
            onChange={(e) => setInvoiceNotes(e.target.value)}
            rows={2}
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateInvoiceOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreatingInvoice}
              disabled={
                !selectedVisitId ||
                !hasValidConsultationFee ||
                isLoadingVisitServices ||
                isVisitServicesError ||
                invoiceDiscount > selectedVisitSubtotal ||
                isCreatingInvoice
              }
              leftIcon={<LuCircleCheck className="w-3.5 h-3.5" />}
            >
              {t("invoices.create.confirm")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={Boolean(paymentInvoice)}
        onClose={() => setPaymentInvoice(null)}
        invoice={paymentInvoice}
        onPaymentSuccess={() => {
          refetch();
          if (viewInvoice && viewInvoice._id === paymentInvoice?._id) {
            setViewInvoice(null);
          }
        }}
      />

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
