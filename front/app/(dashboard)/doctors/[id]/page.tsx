"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useGetDoctorByIdQuery } from "@/services/api/doctorApi";
import { useGetSchedulesQuery } from "@/services/api/scheduleApi";
import { useGetAppointmentsQuery } from "@/services/api/appointmentApi";
import {
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  StatusBadge,
  DataTable,
  Button,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import {
  LuArrowLeft,
  LuCalendar,
  LuClock,
  LuStethoscope,
  LuDollarSign,
  LuAward,
} from "react-icons/lu";

export default function DoctorProfilePage() {
  const { t } = useTranslation();
  const params = useParams();
  const doctorId = params.id as string;

  const { data: doctorData, isLoading, isError, refetch } =
    useGetDoctorByIdQuery(doctorId);
  const doctor = doctorData?.data;

  const { data: schedulesData, isLoading: isSchedulesLoading } =
    useGetSchedulesQuery({ doctor: doctorId });

  const { data: appointmentsData, isLoading: isAptsLoading } =
    useGetAppointmentsQuery({ doctor: doctorId, limit: 10 });

  if (isError) {
    return <ErrorState message={t("doctorProfile.errorNotFound")} onRetry={refetch} />;
  }

  if (isLoading || !doctor) {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  const userObj = typeof doctor.user === "object" && doctor.user ? doctor.user : null;
  const fullName = userObj
    ? `Dr. ${userObj.firstName} ${userObj.lastName}`
    : t("common.doctor");

  const DAYS = [
    t("days.sunday"),
    t("days.monday"),
    t("days.tuesday"),
    t("days.wednesday"),
    t("days.thursday"),
    t("days.friday"),
    t("days.saturday"),
  ];

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <PageHeader
        title={fullName}
        subtitle={doctor.specialization}
        backAction={
          <Link href="/doctors">
            <Button variant="ghost" size="sm" leftIcon={<LuArrowLeft className="w-4 h-4" />}>
              {t("doctorProfile.backDirectory")}
            </Button>
          </Link>
        }
        badge={<StatusBadge status={doctor.isActive ? "active" : "inactive"} size="sm" />}
      />

      {/* Identity Card */}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4 md:border-r md:border-border-subtle md:pr-4">
            <div className="w-14 h-14 rounded-full bg-mint text-teal-dark font-bold text-lg flex items-center justify-center shrink-0">
              <LuStethoscope className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink leading-tight">
                {fullName}
              </h2>
              <p className="text-xs text-teal-primary font-semibold mt-0.5">
                {doctor.specialization}
              </p>
              <p className="text-xs text-slate-muted mt-1 font-mono">
                License: {doctor.licenseNumber}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-xs md:border-r md:border-border-subtle md:pr-4">
            <div className="flex items-center gap-2">
              <LuDollarSign className="w-4 h-4 text-teal-primary shrink-0" />
              <span className="text-slate-muted">{t("doctorProfile.consultationFee")}</span>
              <span className="font-bold text-ink">${doctor.consultationFee.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <LuAward className="w-4 h-4 text-teal-primary shrink-0" />
              <span className="text-slate-muted">{t("doctorProfile.experience")}</span>
              <span className="font-semibold text-ink">
                {t("doctorProfile.years", { count: doctor.yearsOfExperience })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <LuCalendar className="w-4 h-4 text-slate-light shrink-0" />
              <span className="text-slate-muted">{t("doctorProfile.totalScheduledAppointments")}</span>
              <span className="font-semibold text-ink">
                {appointmentsData?.pagination?.total ?? 0}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-muted">
            <span className="font-semibold text-ink uppercase tracking-wider text-[11px] block mb-1">
              {t("doctorProfile.biography")}
            </span>
            <p className="leading-relaxed">
              {doctor.bio || t("doctorProfile.biographyEmpty")}
            </p>
          </div>
        </div>
      </Card>

      {/* Weekly Availability Schedule */}
      <Card>
        <CardHeader
          title={t("doctorProfile.scheduleTitle")}
          subtitle={t("doctorProfile.scheduleSubtitle")}
        />
        <CardContent>
          {isSchedulesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : schedulesData?.data?.length === 0 ? (
            <p className="text-xs text-slate-muted text-center py-4">
              {t("doctorProfile.noSchedules")}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {schedulesData?.data?.map((sch) => (
                <div
                  key={sch._id}
                  className="p-3 rounded-lg bg-paper border border-border-subtle flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-ink">
                      {DAYS[sch.dayOfWeek]}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-status-success" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-muted font-mono mt-1">
                    <LuClock className="w-3.5 h-3.5 text-teal-primary" />
                    <span>
                      {sch.startTime} - {sch.endTime}
                    </span>
                  </div>
                  {sch.breakStart && sch.breakEnd && (
                    <span className="text-[10px] text-slate-light">
                      Break: {sch.breakStart} - {sch.breakEnd}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Appointments for Doctor */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">
          {t("doctorProfile.scheduledAppointments", { count: appointmentsData?.pagination?.total ?? 0 })}
        </h3>
        <DataTable
          columns={[
            {
              key: "patient",
              header: t("common.patient"),
              render: (a) =>
                typeof a.patient === "object" && a.patient
                  ? `${a.patient.firstName} ${a.patient.lastName}`
                  : t("common.patient"),
            },
            {
              key: "date",
              header: t("common.dateTime"),
              render: (a) => (
                <span className="font-mono text-xs">
                  {new Date(a.appointmentDate).toLocaleString()}
                </span>
              ),
            },
            {
              key: "duration",
              header: t("common.duration"),
              render: (a) => t("common.minutesShort", { count: a.duration }),
            },
            {
              key: "status",
              header: t("common.status"),
              render: (a) => <StatusBadge status={a.status} size="sm" />,
            },
          ]}
          data={appointmentsData?.data}
          isLoading={isAptsLoading}
          emptyTitle={t("doctorProfile.emptyTitle")}
          emptyDescription={t("doctorProfile.emptyDescription")}
        />
      </div>
    </div>
  );
}
