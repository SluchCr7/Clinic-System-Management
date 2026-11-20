"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreatePatientMutation } from "@/services/api/patientApi";
import { useGetMyDoctorsQuery } from "@/services/api/doctorAssignmentApi";
import type { BloodType, Gender } from "@/types/patient";
import {
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import { extractApiError } from "@/services/api/baseQuery";
import { LuArrowLeft, LuSave } from "react-icons/lu";

export default function NewPatientPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [createPatient, { isLoading }] = useCreatePatientMutation();
  const { data: myDoctorsData, isLoading: isLoadingDoctors } = useGetMyDoctorsQuery();
  const assignedDoctors = myDoctorsData?.data || [];

  const [formData, setFormData] = useState({
    doctor: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "male" as Gender,
    phone: "",
    email: "",
    bloodType: "" as BloodType | "",
    allergies: "",
    chronicDiseases: "",
    address: {
      street: "",
      city: "",
      country: "",
    },
    emergencyContact: {
      name: "",
      relationship: "",
      phone: "",
    },
  });

  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (assignedDoctors.length === 1 && !formData.doctor) {
      setFormData((prev) => ({ ...prev, doctor: assignedDoctors[0]._id }));
    }
  }, [assignedDoctors, formData.doctor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.phone) {
      setFormError(t("patientForm.requiredFields"));
      return;
    }

    if (!formData.doctor) {
      setFormError(
        t("patientForm.selectDoctorRequired", "Please select a doctor for this patient")
      );
      return;
    }

    try {
      const payload = {
        doctor: formData.doctor,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        phone: formData.phone.trim(),
        email: formData.email.trim() ? formData.email.trim() : undefined,
        bloodType: (formData.bloodType as BloodType) || undefined,
        allergies: formData.allergies
          ? formData.allergies.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        chronicDiseases: formData.chronicDiseases
          ? formData.chronicDiseases.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        address: {
          street: formData.address.street.trim() || undefined,
          city: formData.address.city.trim() || undefined,
          country: formData.address.country.trim() || undefined,
        },
        emergencyContact: {
          name: formData.emergencyContact.name.trim() || undefined,
          relationship: formData.emergencyContact.relationship.trim() || undefined,
          phone: formData.emergencyContact.phone.trim() || undefined,
        },
      };

      const res = await createPatient(payload).unwrap();
      if (res.success && res.data) {
        toast.success(
          t("patientForm.success", {
            firstName: res.data.firstName,
            lastName: res.data.lastName,
          })
        );
        router.push(`/patients/${res.data._id}`);
      }
    } catch (err) {
      const extracted = extractApiError(err);
      setFormError(extracted.message || t("patientForm.requiredMessage"));
      toast.error(extracted.message || t("patientForm.saveFailed"));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-4xl mx-auto">
      <PageHeader
        title={t("patientForm.title")}
        subtitle={t("patientForm.subtitle")}
        backAction={
          <Link href="/patients">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LuArrowLeft className="w-4 h-4" />}
            >
              {t("patientForm.back")}
            </Button>
          </Link>
        }
        actions={
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            leftIcon={<LuSave className="w-4 h-4" />}
          >
            {t("patientForm.save")}
          </Button>
        }
      />

      {formError && (
        <div className="p-3.5 rounded-lg bg-status-error-bg border border-status-error/20 text-xs text-status-error leading-relaxed">
          {formError}
        </div>
      )}

      {/* Clinic Workspace & Assigned Doctor */}
      <Card>
        <CardHeader
          title={t("patientForm.clinicWorkspaceTitle", "Clinic Workspace Assignment")}
          subtitle={t(
            "patientForm.clinicWorkspaceSubtitle",
            "Select the doctor clinic workspace this patient belongs to."
          )}
        />
        <CardContent>
          {assignedDoctors.length === 0 && !isLoadingDoctors ? (
            <div className="p-3.5 rounded-lg bg-status-warning-bg border border-status-warning/20 text-xs text-status-warning leading-relaxed">
              {t(
                "patientForm.noAssignedDoctors",
                "You are not assigned to any active doctor clinic. Please contact an administrator to assign you to a doctor before creating patients."
              )}
            </div>
          ) : (
            <Select
              label={t("patientForm.assignedDoctor", "Doctor Clinic")}
              required
              disabled={assignedDoctors.length === 1}
              value={formData.doctor}
              onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
              options={[
                {
                  value: "",
                  label: t("patientForm.selectDoctorPlaceholder", "Select a doctor..."),
                },
                ...assignedDoctors.map((doc) => {
                  const userObj = typeof doc.user === "object" ? doc.user : null;
                  const name = userObj
                    ? `Dr. ${userObj.firstName} ${userObj.lastName}`
                    : `Doctor (${doc.specialization})`;
                  return {
                    value: doc._id,
                    label: `${name} — ${doc.specialization}`,
                  };
                }),
              ]}
              helperText={
                assignedDoctors.length === 1
                  ? t("patientForm.singleDoctorAssigned", "Auto-assigned to your clinic doctor.")
                  : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      {/* 1. Personal Identity */}
      <Card>
        <CardHeader
          title={t("patientForm.sectionPersonalTitle")}
          subtitle={t("patientForm.sectionPersonalSubtitle")}
        />
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t("patientForm.firstName")}
            required
            value={formData.firstName}
            onChange={(e) =>
              setFormData({ ...formData, firstName: e.target.value })
            }
            placeholder={t("patientForm.firstNamePlaceholder")}
          />
          <Input
            label={t("patientForm.lastName")}
            required
            value={formData.lastName}
            onChange={(e) =>
              setFormData({ ...formData, lastName: e.target.value })
            }
            placeholder={t("patientForm.lastNamePlaceholder")}
          />
          <Input
            label={t("patientForm.dateOfBirth")}
            type="date"
            required
            value={formData.dateOfBirth}
            onChange={(e) =>
              setFormData({ ...formData, dateOfBirth: e.target.value })
            }
          />
          <Select
            label={t("patientForm.gender")}
            required
            value={formData.gender}
            onChange={(e) =>
              setFormData({ ...formData, gender: e.target.value as Gender })
            }
            options={[
              { value: "male", label: t("patientForm.male") },
              { value: "female", label: t("patientForm.female") },
            ]}
          />
        </CardContent>
      </Card>

      {/* 2. Contact & Residence */}
      <Card>
        <CardHeader
          title={t("patientForm.sectionContactTitle")}
          subtitle={t("patientForm.sectionContactSubtitle")}
        />
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t("patientForm.phoneNumber")}
            type="tel"
            required
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            placeholder={t("patientForm.phonePlaceholder")}
          />
          <Input
            label={t("patientForm.emailAddress")}
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder={t("patientForm.emailPlaceholder")}
          />
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label={t("patientForm.streetAddress")}
              value={formData.address.street}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, street: e.target.value },
                })
              }
              placeholder={t("patientForm.addressPlaceholder")}
            />
            <Input
              label={t("patientForm.city")}
              value={formData.address.city}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, city: e.target.value },
                })
              }
            />
            <Input
              label={t("patientForm.country")}
              value={formData.address.country}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, country: e.target.value },
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Emergency Contact */}
      <Card>
        <CardHeader
          title={t("patientForm.sectionEmergencyTitle")}
          subtitle={t("patientForm.sectionEmergencySubtitle")}
        />
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label={t("patientForm.emergencyContactName")}
            value={formData.emergencyContact.name}
            onChange={(e) =>
              setFormData({
                ...formData,
                emergencyContact: {
                  ...formData.emergencyContact,
                  name: e.target.value,
                },
              })
            }
            placeholder={t("patientForm.emergencyContactNamePlaceholder")}
          />
          <Input
            label={t("patientForm.emergencyContactRelationship")}
            value={formData.emergencyContact.relationship}
            onChange={(e) =>
              setFormData({
                ...formData,
                emergencyContact: {
                  ...formData.emergencyContact,
                  relationship: e.target.value,
                },
              })
            }
            placeholder={t("patientForm.relationshipPlaceholder")}
          />
          <Input
            label={t("patientForm.emergencyContactPhone")}
            type="tel"
            value={formData.emergencyContact.phone}
            onChange={(e) =>
              setFormData({
                ...formData,
                emergencyContact: {
                  ...formData.emergencyContact,
                  phone: e.target.value,
                },
              })
            }
            placeholder={t("patientForm.phonePlaceholder")}
          />
        </CardContent>
      </Card>

      {/* 4. Clinical Indicators */}
      <Card>
        <CardHeader
          title={t("patientForm.sectionClinicalTitle")}
          subtitle={t("patientForm.sectionClinicalSubtitle")}
        />
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={t("patientForm.bloodType")}
            value={formData.bloodType}
            onChange={(e) =>
              setFormData({
                ...formData,
                bloodType: e.target.value as BloodType,
              })
            }
            placeholder={t("patientForm.bloodTypePlaceholder")}
            options={[
              { value: "A+", label: "A+" },
              { value: "A-", label: "A-" },
              { value: "B+", label: "B+" },
              { value: "B-", label: "B-" },
              { value: "AB+", label: "AB+" },
              { value: "AB-", label: "AB-" },
              { value: "O+", label: "O+" },
              { value: "O-", label: "O-" },
            ]}
          />

          <div className="hidden sm:block" />

          <Textarea
            label={t("patientForm.knownAllergies")}
            value={formData.allergies}
            onChange={(e) =>
              setFormData({ ...formData, allergies: e.target.value })
            }
            placeholder={t("patientForm.allergiesPlaceholder")}
            helperText={t("patientForm.helperNoAllergies")}
          />

          <Textarea
            label={t("patientForm.chronicConditions")}
            value={formData.chronicDiseases}
            onChange={(e) =>
              setFormData({ ...formData, chronicDiseases: e.target.value })
            }
            placeholder={t("patientForm.chronicConditionsPlaceholder")}
            helperText={t("patientForm.helperNoConditions")}
          />
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            leftIcon={<LuSave className="w-4 h-4" />}
          >
            {t("patientForm.createMedicalFile")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
