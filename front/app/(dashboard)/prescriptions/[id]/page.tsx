"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useGetPrescriptionByIdQuery } from "@/services/api/prescriptionApi";
import {
  PageHeader,
  Card,
  Button,
  Logo,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import { LuArrowLeft, LuPrinter } from "react-icons/lu";

export default function PrescriptionDetailPage() {
  const params = useParams();
  const rxId = params.id as string;

  const { data: rxData, isLoading, isError, refetch } =
    useGetPrescriptionByIdQuery(rxId);
  const rx = rxData?.data;

  if (isError) {
    return <ErrorState message="Could not find prescription file." onRetry={refetch} />;
  }

  if (isLoading || !rx) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const patient = typeof rx.patient === "object" && rx.patient ? rx.patient : null;
  const doctor = typeof rx.doctor === "object" && rx.doctor ? rx.doctor : null;
  const doctorUser = doctor && typeof doctor.user === "object" && doctor.user ? doctor.user : null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Top action bar - hidden when printing */}
      <div className="no-print">
        <PageHeader
          title="Prescription Document"
          subtitle={`RX Reference: ${rx._id}`}
          backAction={
            <Link href="/prescriptions">
              <Button variant="ghost" size="sm" leftIcon={<LuArrowLeft className="w-4 h-4" />}>
                Prescriptions
              </Button>
            </Link>
          }
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              leftIcon={<LuPrinter className="w-3.5 h-3.5" />}
            >
              Print Prescription
            </Button>
          }
        />
      </div>

      {/* Printable Clinical Prescription Sheet */}
      <Card className="bg-surface p-8 border-border-subtle shadow-card flex flex-col gap-8 print:border-none print:shadow-none print:p-0">
        {/* Prescription Header */}
        <div className="flex items-start justify-between border-b-2 border-teal-primary pb-5">
          <div>
            <Logo size="md" />
            <p className="text-xs text-slate-muted mt-2">
              AuraClinic Medical Center • Outpatient Care
            </p>
            <p className="text-[11px] text-slate-light">
              Tel: +20 2 2456 7890 • Cairo, Egypt
            </p>
          </div>

          <div className="text-right">
            <h2 className="text-sm font-bold text-ink">
              {doctorUser ? `Dr. ${doctorUser.firstName} ${doctorUser.lastName}` : "Physician"}
            </h2>
            <p className="text-xs text-teal-primary font-medium">
              {doctor?.specialization || "Clinical Practice"}
            </p>
            <p className="text-[11px] text-slate-muted font-mono mt-0.5">
              License: {doctor?.licenseNumber || "N/A"}
            </p>
            <p className="text-xs text-slate-dark mt-1 font-mono">
              Date: {new Date(rx.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Patient Demographic Information */}
        <div className="p-3.5 rounded-lg bg-paper border border-border-subtle grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-muted block">
              Patient Name:
            </span>
            <span className="font-bold text-ink">
              {patient ? `${patient.firstName} ${patient.lastName}` : "Patient"}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-muted block">
              Phone:
            </span>
            <span className="font-mono text-slate-dark">
              {patient?.phone || "N/A"}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-muted block">
              Blood Group:
            </span>
            <span className="font-mono font-bold text-ink">
              {patient?.bloodType || "N/A"}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-muted block">
              Rx Code:
            </span>
            <span className="font-mono text-slate-muted">
              {rx._id.slice(-8).toUpperCase()}
            </span>
          </div>
        </div>

        {/* RX Symbol & Medication Schedule Table */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl font-serif font-black text-teal-primary tracking-tight">
              ℞
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-muted">
              Prescribed Medications
            </span>
          </div>

          <div className="border border-border-subtle rounded-md overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper border-b border-border-subtle">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-slate-muted text-[11px]">
                    #
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-slate-muted text-[11px]">
                    Drug Name & Form
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-slate-muted text-[11px]">
                    Dosage
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-slate-muted text-[11px]">
                    Frequency
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-slate-muted text-[11px]">
                    Duration
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-slate-muted text-[11px]">
                    Route
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rx.medications.map((m, idx) => (
                  <React.Fragment key={idx}>
                    <tr className="font-medium text-ink bg-surface">
                      <td className="py-2.5 px-3 text-slate-light font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-ink">
                        {m.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{m.dosage}</td>
                      <td className="py-2.5 px-3">{m.frequency}</td>
                      <td className="py-2.5 px-3">{m.duration}</td>
                      <td className="py-2.5 px-3 capitalize text-slate-muted">
                        {m.route || "Oral"}
                      </td>
                    </tr>
                    {m.instructions && (
                      <tr className="bg-paper/30 text-[11px] text-slate-muted">
                        <td />
                        <td colSpan={5} className="py-1 px-3 italic">
                          Instructions: {m.instructions}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* General Instructions & Advice */}
        {rx.generalInstructions && (
          <div className="p-3.5 rounded-lg border border-border-subtle bg-paper/30 text-xs">
            <span className="font-semibold text-ink uppercase tracking-wider text-[10px] block mb-1">
              General Patient Instructions:
            </span>
            <p className="text-slate-muted leading-relaxed">
              {rx.generalInstructions}
            </p>
          </div>
        )}

        {/* Doctor Signature & Stamp Area */}
        <div className="pt-12 flex items-end justify-between text-xs">
          <div className="text-[10px] text-slate-light max-w-xs leading-relaxed">
            * This prescription is valid for 30 days from date of issuance.
            Take medications strictly as indicated by your physician.
          </div>

          <div className="flex flex-col items-center">
            <div className="w-48 border-b border-ink/40 mb-1" />
            <span className="font-semibold text-ink text-[11px]">
              {doctorUser ? `Dr. ${doctorUser.firstName} ${doctorUser.lastName}` : "Physician Signature"}
            </span>
            <span className="text-[10px] text-slate-muted">
              Licensed Practitioner
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
