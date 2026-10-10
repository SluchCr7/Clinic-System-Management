"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetRevenueReportQuery,
  useGetAppointmentsReportQuery,
  useGetPatientsReportQuery,
  useGetDoctorsReportQuery,
  useGetLabOrdersReportQuery,
  useGetPaymentsReportQuery,
  useGetMedicalServicesReportQuery,
} from "@/services/api/dashboardApi";
import type { DashboardReportPeriod } from "@/types/dashboard";
import {
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  StatCard,
  Tabs,
  Select,
  StatusBadge,
  Badge,
  Skeleton,
} from "@/components/ui";
import {
  LuDollarSign,
  LuCalendar,
  LuUsers,
  LuStethoscope,
  LuFlaskConical,
  LuCreditCard,
  LuActivity,
  LuTrendingUp,
} from "react-icons/lu";

export default function ReportsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<DashboardReportPeriod>("month");
  const [activeTab, setActiveTab] = useState<string>("revenue");

  // Query Hooks
  const { data: revData, isLoading: revLoading } = useGetRevenueReportQuery({ period });
  const { data: apptData, isLoading: apptLoading } = useGetAppointmentsReportQuery({ period });
  const { data: patData, isLoading: patLoading } = useGetPatientsReportQuery({ period });
  const { data: docData, isLoading: docLoading } = useGetDoctorsReportQuery({ period });
  const { data: labData, isLoading: labLoading } = useGetLabOrdersReportQuery({ period });
  const { data: payData, isLoading: payLoading } = useGetPaymentsReportQuery({ period });
  const { data: svcsData, isLoading: svcsLoading } = useGetMedicalServicesReportQuery({ period });

  const tabs = [
    { id: "revenue", label: t("reports.tabs.revenue"), icon: <LuDollarSign className="w-3.5 h-3.5" /> },
    { id: "appointments", label: t("reports.tabs.appointments"), icon: <LuCalendar className="w-3.5 h-3.5" /> },
    { id: "patients", label: t("reports.tabs.patients"), icon: <LuUsers className="w-3.5 h-3.5" /> },
    { id: "doctors", label: t("reports.tabs.doctors"), icon: <LuStethoscope className="w-3.5 h-3.5" /> },
    { id: "lab", label: t("reports.tabs.lab"), icon: <LuFlaskConical className="w-3.5 h-3.5" /> },
    { id: "payments", label: t("reports.tabs.payments"), icon: <LuCreditCard className="w-3.5 h-3.5" /> },
    { id: "services", label: t("reports.tabs.services"), icon: <LuActivity className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("reports.title")}
        subtitle={t("reports.subtitle")}
        actions={
          <div className="w-36">
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value as DashboardReportPeriod)}
              options={[
                { value: "today", label: t("reports.period.today") },
                { value: "week", label: t("reports.period.week") },
                { value: "month", label: t("reports.period.month") },
                { value: "year", label: t("reports.period.year") },
              ]}
            />
          </div>
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Revenue Tab */}
      {activeTab === "revenue" && (
        <div className="flex flex-col gap-5">
          {revLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title={t("reports.revenue.totalCollectedRevenue")}
                value={`$${(revData?.data?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                description={t("reports.revenue.collectedDescription")}
                icon={<LuDollarSign className="w-5 h-5" />}
                variant="teal"
              />
              <StatCard
                title={t("reports.revenue.totalInvoicedValue")}
                value={`$${(revData?.data?.totalInvoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                description={t("reports.revenue.invoicedDescription")}
                icon={<LuTrendingUp className="w-5 h-5" />}
              />
              <StatCard
                title={t("reports.revenue.outstandingReceivables")}
                value={`$${(revData?.data?.totalOutstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                description={t("reports.revenue.outstandingDescription")}
                icon={<LuCreditCard className="w-5 h-5" />}
                variant="warning"
              />
            </div>
          )}

          {/* Daily Revenue Table */}
          <Card>
            <CardHeader
              title={t("reports.revenue.dailyTitle")}
              subtitle={t("reports.revenue.dailySubtitle")}
            />
            <CardContent>
              {revData?.data?.dailyRevenue && revData.data.dailyRevenue.length > 0 ? (
                <div className="border border-border-subtle rounded-md overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-paper text-slate-muted font-medium border-b border-border-subtle">
                      <tr>
                        <th className="py-2.5 px-4">{t("reports.date")}</th>
                        <th className="py-2.5 px-4 text-right">{t("reports.revenue.dailyCollectedAmount")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {revData.data.dailyRevenue.map((d, idx) => (
                        <tr key={idx} className="hover:bg-paper/40">
                          <td className="py-2.5 px-4 font-mono text-ink">{d.date}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-teal-dark">
                            ${d.revenue?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-muted py-6 text-center">
                  {t("reports.revenue.empty")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Appointments Tab */}
      {activeTab === "appointments" && (
        <div className="flex flex-col gap-5">
          {apptLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title={t("reports.appointments.totalEncounters")}
                value={apptData?.data?.totalAppointments || 0}
                description={t("reports.appointments.totalEncountersDescription")}
                icon={<LuCalendar className="w-5 h-5" />}
                variant="teal"
              />
              <StatCard
                title={t("reports.appointments.completed")}
                value={apptData?.data?.byStatus?.completed || 0}
                description={t("reports.appointments.completedDescription")}
                icon={<LuCalendar className="w-5 h-5" />}
                variant="success"
              />
              <StatCard
                title={t("reports.appointments.scheduledConfirmed")}
                value={(apptData?.data?.byStatus?.scheduled || 0) + (apptData?.data?.byStatus?.confirmed || 0)}
                description={t("reports.appointments.scheduledDescription")}
                icon={<LuCalendar className="w-5 h-5" />}
              />
              <StatCard
                title={t("reports.appointments.cancellationsNoShows")}
                value={(apptData?.data?.byStatus?.cancelled || 0) + (apptData?.data?.byStatus?.no_show || 0)}
                description={t("reports.appointments.cancellationsDescription")}
                icon={<LuCalendar className="w-5 h-5" />}
                variant="warning"
              />
            </div>
          )}

          <Card>
            <CardHeader
              title={t("reports.appointments.volumeByStatus")}
              subtitle={t("reports.appointments.volumeSubtitle")}
            />
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(apptData?.data?.byStatus || {}).map(([status, count]) => (
                  <div key={status} className="p-3 bg-paper rounded-lg border border-border-subtle flex flex-col gap-1">
                    <StatusBadge status={status} size="sm" />
                    <span className="text-xl font-bold text-ink mt-2">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Patients Tab */}
      {activeTab === "patients" && (
        <div className="flex flex-col gap-5">
          {patLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title={t("reports.patients.newRegistered")}
                value={patData?.data?.totalNewPatients || 0}
                description={t("reports.patients.newRegisteredDescription")}
                icon={<LuUsers className="w-5 h-5" />}
                variant="teal"
              />
              <StatCard
                title={t("reports.patients.activeFiles")}
                value={patData?.data?.activePatients || 0}
                description={t("reports.patients.activeFilesDescription")}
                icon={<LuUsers className="w-5 h-5" />}
                variant="success"
              />
              <StatCard
                title={t("reports.patients.inactiveRecords")}
                value={patData?.data?.inactivePatients || 0}
                description={t("reports.patients.inactiveRecordsDescription")}
                icon={<LuUsers className="w-5 h-5" />}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader title={t("reports.patients.genderDistribution")} subtitle={t("reports.patients.genderSubtitle")} />
              <CardContent>
                <div className="flex flex-col gap-3">
                  {Object.entries(patData?.data?.patientsByGender || {}).map(([gender, count]) => (
                    <div key={gender} className="flex justify-between items-center text-xs p-2.5 bg-paper rounded-md">
                      <span className="capitalize font-medium text-ink">{t(`reports.genders.${gender}`, { defaultValue: gender })}</span>
                      <span className="font-bold text-teal-dark">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title={t("reports.patients.ageDemographics")} subtitle={t("reports.patients.ageSubtitle")} />
              <CardContent>
                <div className="flex flex-col gap-3">
                  {Object.entries(patData?.data?.patientsByAgeGroup || {}).map(([ageGroup, count]) => (
                    <div key={ageGroup} className="flex justify-between items-center text-xs p-2.5 bg-paper rounded-md">
                      <span className="font-medium text-ink">{ageGroup}</span>
                      <span className="font-bold text-teal-dark">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Doctors Tab */}
      {activeTab === "doctors" && (
        <div className="flex flex-col gap-5">
          {docLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                title={t("reports.doctors.totalStaff")}
                value={docData?.data?.totalDoctors || 0}
                description={t("reports.doctors.totalStaffDescription")}
                icon={<LuStethoscope className="w-5 h-5" />}
                variant="teal"
              />
              <StatCard
                title={t("reports.doctors.activePractitioners")}
                value={docData?.data?.activeDoctors || 0}
                description={t("reports.doctors.activePractitionersDescription")}
                icon={<LuStethoscope className="w-5 h-5" />}
                variant="success"
              />
            </div>
          )}

          <Card>
            <CardHeader
              title={t("reports.doctors.productivityTitle")}
              subtitle={t("reports.doctors.productivitySubtitle")}
            />
            <CardContent>
              {docData?.data?.doctorPerformance && docData.data.doctorPerformance.length > 0 ? (
                <div className="border border-border-subtle rounded-md overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-paper text-slate-muted font-medium border-b border-border-subtle">
                      <tr>
                        <th className="py-2.5 px-4">{t("reports.doctors.name")}</th>
                        <th className="py-2.5 px-4">{t("reports.doctors.specialization")}</th>
                        <th className="py-2.5 px-3 text-right">{t("reports.doctors.appointments")}</th>
                        <th className="py-2.5 px-3 text-right">{t("reports.doctors.visitsConducted")}</th>
                        <th className="py-2.5 px-4 text-right">{t("reports.doctors.revenueYield")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {docData.data.doctorPerformance.map((d, idx) => (
                        <tr key={idx} className="hover:bg-paper/40">
                          <td className="py-2.5 px-4 font-semibold text-ink">{d.doctorName}</td>
                          <td className="py-2.5 px-4 text-slate-muted">{d.specialization}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-ink">{d.appointmentCount}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-ink">{d.visitCount}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-teal-dark">
                            ${d.revenueGenerated?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-muted py-6 text-center">
                  {t("reports.doctors.empty")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lab Tab */}
      {activeTab === "lab" && (
        <div className="flex flex-col gap-5">
          {labLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title={t("reports.lab.totalRequisitions")}
                value={labData?.data?.totalOrders || 0}
                description={t("reports.lab.totalRequisitionsDescription")}
                icon={<LuFlaskConical className="w-5 h-5" />}
                variant="teal"
              />
              <StatCard
                title={t("reports.lab.urgentOrders")}
                value={(labData?.data?.byPriority?.stat || 0) + (labData?.data?.byPriority?.urgent || 0)}
                description={t("reports.lab.urgentOrdersDescription")}
                icon={<LuFlaskConical className="w-5 h-5" />}
                variant="warning"
              />
              <StatCard
                title={t("reports.lab.routineOrders")}
                value={labData?.data?.byPriority?.routine || 0}
                description={t("reports.lab.routineOrdersDescription")}
                icon={<LuFlaskConical className="w-5 h-5" />}
              />
            </div>
          )}

          <Card>
            <CardHeader title={t("reports.lab.topTests")} subtitle={t("reports.lab.topTestsSubtitle")} />
            <CardContent>
              {labData?.data?.topTests && labData.data.topTests.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {labData.data.topTests.map((test, idx) => (
                    <div key={idx} className="p-3 bg-paper rounded-lg border border-border-subtle flex justify-between items-center">
                      <span className="font-semibold text-xs text-ink">{test.name}</span>
                      <Badge variant="teal" size="sm">{t("reports.lab.orderCount", { count: test.count })}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-muted py-6 text-center">
                  {t("reports.lab.empty")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="flex flex-col gap-5">
          {payLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                title={t("reports.payments.totalCollected")}
                value={`$${(payData?.data?.totalCollected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                description={t("reports.payments.totalCollectedDescription")}
                icon={<LuCreditCard className="w-5 h-5" />}
                variant="teal"
              />
              <StatCard
                title={t("reports.payments.transactions")}
                value={payData?.data?.totalTransactions || 0}
                description={t("reports.payments.transactionsDescription")}
                icon={<LuCreditCard className="w-5 h-5" />}
              />
            </div>
          )}

          <Card>
            <CardHeader title={t("reports.payments.collectionsByMethod")} subtitle={t("reports.payments.collectionsSubtitle")} />
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(payData?.data?.byMethod || {}).map(([method, amount]) => (
                  <div key={method} className="p-3.5 bg-paper rounded-lg border border-border-subtle flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase text-slate-muted">{t(`payments.methods.${method}`, { defaultValue: method.replace("_", " ") })}</span>
                    <span className="text-base font-bold text-teal-dark mt-1">
                      ${amount?.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Medical Services Tab */}
      {activeTab === "services" && (
        <div className="flex flex-col gap-5">
          {svcsLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                title={t("reports.services.performed")}
                value={svcsData?.data?.totalPerformed || 0}
                description={t("reports.services.performedDescription")}
                icon={<LuActivity className="w-5 h-5" />}
                variant="teal"
              />
              <StatCard
                title={t("reports.services.revenueYield")}
                value={`$${(svcsData?.data?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                description={t("reports.services.revenueDescription")}
                icon={<LuActivity className="w-5 h-5" />}
                variant="success"
              />
            </div>
          )}

          <Card>
            <CardHeader title={t("reports.services.topTitle")} subtitle={t("reports.services.topSubtitle")} />
            <CardContent>
              {svcsData?.data?.topServices && svcsData.data.topServices.length > 0 ? (
                <div className="border border-border-subtle rounded-md overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-paper text-slate-muted font-medium border-b border-border-subtle">
                      <tr>
                        <th className="py-2.5 px-4">{t("reports.services.name")}</th>
                        <th className="py-2.5 px-4 text-right">{t("reports.services.performedCount")}</th>
                        <th className="py-2.5 px-4 text-right">{t("reports.services.grossRevenue")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {svcsData.data.topServices.map((s, idx) => (
                        <tr key={idx} className="hover:bg-paper/40">
                          <td className="py-2.5 px-4 font-semibold text-ink">{s.name}</td>
                          <td className="py-2.5 px-4 text-right font-medium text-ink">{s.count}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-teal-dark">
                            ${s.revenue?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-muted py-6 text-center">
                  {t("reports.services.empty")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
