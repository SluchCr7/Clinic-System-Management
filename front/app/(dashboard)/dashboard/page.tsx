"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/redux/hooks";
import { selectCurrentUser, selectUserRole } from "@/features/auth/authSelectors";
import { useGetDashboardOverviewQuery } from "@/services/api/dashboardApi";
import { useGetAppointmentsQuery } from "@/services/api/appointmentApi";
import { useGetPatientsQuery } from "@/services/api/patientApi";
import { useGetPaymentsQuery } from "@/services/api/paymentApi";
import {
  PageHeader,
  StatCard,
  Card,
  CardHeader,
  CardContent,
  Button,
  StatusBadge,
  Skeleton,
} from "@/components/ui";
import {
  LuUsers,
  LuCalendar,
  LuDollarSign,
  LuFlaskConical,
  LuClipboardCheck,
  LuPlus,
  LuArrowRight,
  LuStethoscope,
  LuReceipt,
} from "react-icons/lu";

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const user = useAppSelector(selectCurrentUser);
  const role = useAppSelector(selectUserRole);

  const { data: overviewData, isLoading: isOverviewLoading } =
    useGetDashboardOverviewQuery(undefined, {
      skip: role !== "admin",
    });

  const { data: recentAppointments, isLoading: isAppointmentsLoading } =
    useGetAppointmentsQuery({ limit: 5, sortBy: "appointmentDate", sortOrder: "desc" });

  const { data: recentPatients, isLoading: isPatientsLoading } =
    useGetPatientsQuery({ limit: 5, sortBy: "createdAt", sortOrder: "desc" });

  const { data: recentPayments, isLoading: isPaymentsLoading } =
    useGetPaymentsQuery({ limit: 5, sortBy: "paidAt", sortOrder: "desc" }, {
      skip: role === "doctor",
    });

  const overview = overviewData?.data;

  const locale = i18n.language === "ar" ? "ar-EG" : "en-US";
  const todayStr = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("dashboard.welcome", {
          name: `Dr. ${user?.lastName || user?.firstName || t("dashboard.staffFallback")}`,
        })}
        subtitle={t("dashboard.overviewWithDate", { date: todayStr })}
        badge={<StatusBadge status={role || "staff"} size="sm" />}
        actions={
          role === "receptionist" || role === "admin" ? (
            <div className="flex items-center gap-2">
              <Link href="/patients/new">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<LuPlus className="w-3.5 h-3.5" />}
                >
                  {t("dashboard.newPatient")}
                </Button>
              </Link>
              <Link href="/appointments">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<LuCalendar className="w-3.5 h-3.5" />}
                >
                  {t("dashboard.bookAppointment")}
                </Button>
              </Link>
            </div>
          ) : role === "doctor" ? (
            <Link href="/visits">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<LuClipboardCheck className="w-3.5 h-3.5" />}
              >
                {t("dashboard.consultations")}
              </Button>
            </Link>
          ) : null
        }
      />

      {/* ADMIN METRICS */}
      {role === "admin" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            highlight
            title={t("dashboard.todayAppointments")}
            value={
              isOverviewLoading
                ? "..."
                : overview?.overview?.todayAppointments ?? 0
            }
            subtitle={t("dashboard.todayAppointmentsSubtitle")}
            icon={<LuCalendar className="w-4 h-4" />}
            breakdown={[
              {
                label: t("dashboard.scheduled"),
                value: overview?.appointments?.today?.scheduled ?? 0,
              },
              {
                label: t("dashboard.completed"),
                value: overview?.appointments?.today?.completed ?? 0,
              },
              {
                label: t("dashboard.cancelled"),
                value: overview?.appointments?.today?.cancelled ?? 0,
              },
            ]}
          />

          <StatCard
            title={t("dashboard.totalPatients")}
            value={
              isOverviewLoading
                ? "..."
                : overview?.overview?.totalPatients ?? 0
            }
            subtitle={t("dashboard.totalPatientsSubtitle")}
            icon={<LuUsers className="w-4 h-4" />}
            breakdown={[
              {
                label: t("dashboard.active"),
                value: overview?.overview?.activePatients ?? 0,
              },
              {
                label: t("dashboard.doctors"),
                value: overview?.overview?.activeDoctors ?? 0,
              },
            ]}
          />

          <StatCard
            title={t("dashboard.revenueCollected")}
            value={
              isOverviewLoading
                ? "..."
                : `$${(overview?.financial?.totalCollected ?? 0).toLocaleString()}`
            }
            subtitle={t("dashboard.revenueSubtitle", {
              value: `$${(overview?.financial?.todayRevenue ?? 0).toLocaleString()}`,
            })}
            icon={<LuDollarSign className="w-4 h-4" />}
            breakdown={[
              {
                label: t("dashboard.outstanding"),
                value: `$${(overview?.financial?.totalOutstanding ?? 0).toLocaleString()}`,
              },
            ]}
          />

          <StatCard
            title={t("dashboard.labOrders")}
            value={
              isOverviewLoading
                ? "..."
                : (overview?.labOrders?.pending ?? 0) +
                  (overview?.labOrders?.processing ?? 0)
            }
            subtitle={t("dashboard.labOrdersSubtitle")}
            icon={<LuFlaskConical className="w-4 h-4" />}
            breakdown={[
              {
                label: t("dashboard.pending"),
                value: overview?.labOrders?.pending ?? 0,
              },
              {
                label: t("dashboard.completed"),
                value: overview?.labOrders?.completed ?? 0,
              },
            ]}
          />
        </div>
      )}

      {/* DOCTOR SPECIFIC SUMMARY */}
      {role === "doctor" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            highlight
            title={t("dashboard.appointmentsScheduled")}
            value={isAppointmentsLoading ? "..." : recentAppointments?.pagination?.total ?? 0}
            subtitle={t("dashboard.appointmentsScheduledSubtitle")}
            icon={<LuCalendar className="w-4 h-4" />}
          />
          <StatCard
            title={t("dashboard.patientFiles")}
            value={isPatientsLoading ? "..." : recentPatients?.pagination?.total ?? 0}
            subtitle={t("dashboard.patientFilesSubtitle")}
            icon={<LuUsers className="w-4 h-4" />}
          />
          <StatCard
            title={t("dashboard.clinicalInquiries")}
            value={t("dashboard.activeShort")}
            subtitle={t("dashboard.clinicalInquiriesSubtitle")}
            icon={<LuStethoscope className="w-4 h-4" />}
          />
        </div>
      )}

      {/* RECEPTIONIST SPECIFIC SUMMARY */}
      {role === "receptionist" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            highlight
            title={t("dashboard.appointmentsQueue")}
            value={isAppointmentsLoading ? "..." : recentAppointments?.pagination?.total ?? 0}
            subtitle={t("dashboard.appointmentsQueueSubtitle")}
            icon={<LuCalendar className="w-4 h-4" />}
          />
          <StatCard
            title={t("dashboard.registeredPatients")}
            value={isPatientsLoading ? "..." : recentPatients?.pagination?.total ?? 0}
            subtitle={t("dashboard.registeredPatientsSubtitle")}
            icon={<LuUsers className="w-4 h-4" />}
          />
          <StatCard
            title={t("dashboard.billingCollections")}
            value={isPaymentsLoading ? "..." : recentPayments?.pagination?.total ?? 0}
            subtitle={t("dashboard.billingCollectionsSubtitle")}
            icon={<LuReceipt className="w-4 h-4" />}
          />
        </div>
      )}

      {/* RECENT CLINICAL LISTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointments List */}
        <Card>
          <CardHeader
            title={t("dashboard.upcomingAppointments")}
            subtitle={t("dashboard.upcomingAppointmentsSubtitle")}
            action={
              <Link href="/appointments">
                <Button variant="ghost" size="sm" rightIcon={<LuArrowRight className="w-3.5 h-3.5" />}>
                  {t("dashboard.viewAll")}
                </Button>
              </Link>
            }
          />
          <CardContent className="p-0">
            {isAppointmentsLoading ? (
              <div className="p-4 flex flex-col gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : recentAppointments?.data?.length === 0 ? (
              <p className="p-6 text-xs text-slate-muted text-center">
                {t("dashboard.noAppointmentsToday")}
              </p>
            ) : (
              <div className="divide-y divide-border-subtle/70">
                {recentAppointments?.data?.slice(0, 5).map((apt) => {
                  const patientName =
                    typeof apt.patient === "object" && apt.patient
                      ? `${apt.patient.firstName} ${apt.patient.lastName}`
                      : t("common.patient");

                  const doctorName =
                    typeof apt.doctor === "object" && apt.doctor
                      ? typeof apt.doctor.user === "object" && apt.doctor.user
                        ? `Dr. ${apt.doctor.user.lastName}`
                        : t("common.doctor")
                      : t("common.doctor");

                  const aptDate = new Date(apt.appointmentDate).toLocaleString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }
                  );

                  return (
                    <div
                      key={apt._id}
                      className="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-paper/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-mint text-teal-dark flex items-center justify-center font-semibold text-xs shrink-0">
                          {patientName.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink truncate">
                            {patientName}
                          </p>
                          <p className="text-[11px] text-slate-muted truncate">
                            {doctorName} • {t("dashboard.minutesShort", { count: apt.duration })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 text-right">
                        <span className="text-[11px] text-slate-muted hidden sm:inline-block">
                          {aptDate}
                        </span>
                        <StatusBadge status={apt.status} size="sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Patients List */}
        <Card>
          <CardHeader
            title={t("dashboard.recentPatients")}
            subtitle={t("dashboard.recentPatientsSubtitle")}
            action={
              <Link href="/patients">
                <Button variant="ghost" size="sm" rightIcon={<LuArrowRight className="w-3.5 h-3.5" />}>
                  {t("dashboard.viewAll")}
                </Button>
              </Link>
            }
          />
          <CardContent className="p-0">
            {isPatientsLoading ? (
              <div className="p-4 flex flex-col gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : recentPatients?.data?.length === 0 ? (
              <p className="p-6 text-xs text-slate-muted text-center">
                {t("dashboard.noRecentPatients")}
              </p>
            ) : (
              <div className="divide-y divide-border-subtle/70">
                {recentPatients?.data?.slice(0, 5).map((pt) => {
                  const birthYear = new Date(pt.dateOfBirth).getFullYear();
                  const age = new Date().getFullYear() - birthYear;

                  return (
                    <Link
                      key={pt._id}
                      href={`/patients/${pt._id}`}
                      className="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-paper/40 transition-colors block"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-paper border border-border-subtle text-ink flex items-center justify-center font-medium text-xs shrink-0">
                          {pt.firstName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink truncate">
                            {pt.firstName} {pt.lastName}
                          </p>
                          <p className="text-[11px] text-slate-muted truncate">
                            {pt.gender} • {t("dashboard.yearsShort", { count: age })} • {pt.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {pt.bloodType && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-sm bg-paper text-slate-dark border border-border-subtle">
                            {pt.bloodType}
                          </span>
                        )}
                        <StatusBadge
                          status={pt.isActive ? "active" : "inactive"}
                          size="sm"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
