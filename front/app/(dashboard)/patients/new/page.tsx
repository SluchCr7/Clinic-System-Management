"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreatePatientMutation } from "@/services/api/patientApi";
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
  const [createPatient, { isLoading }] = useCreatePatientMutation();

  const [formData, setFormData] = useState({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.firstName || !formData.lastName || !formData.dateOfBirth || !formData.phone) {
      setFormError("Please fill out all required fields (Name, Date of Birth, Phone).");
      return;
    }

    try {
      const payload = {
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
        toast.success(`Patient ${res.data.firstName} ${res.data.lastName} registered successfully.`);
        router.push(`/patients/${res.data._id}`);
      }
    } catch (err) {
      const extracted = extractApiError(err);
      setFormError(extracted.message || "Failed to register patient. Please verify the input.");
      toast.error(extracted.message || "Failed to register patient.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-4xl mx-auto">
      <PageHeader
        title="Register New Patient"
        subtitle="Complete the clinical intake form to create a new medical file"
        backAction={
          <Link href="/patients">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LuArrowLeft className="w-4 h-4" />}
            >
              Back
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
            Save Patient File
          </Button>
        }
      />

      {formError && (
        <div className="p-3.5 rounded-lg bg-status-error-bg border border-status-error/20 text-xs text-status-error leading-relaxed">
          {formError}
        </div>
      )}

      {/* 1. Personal Identity */}
      <Card>
        <CardHeader
          title="1. Personal Information"
          subtitle="Legal name and demographic details"
        />
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First Name"
            required
            value={formData.firstName}
            onChange={(e) =>
              setFormData({ ...formData, firstName: e.target.value })
            }
            placeholder="John"
          />
          <Input
            label="Last Name"
            required
            value={formData.lastName}
            onChange={(e) =>
              setFormData({ ...formData, lastName: e.target.value })
            }
            placeholder="Doe"
          />
          <Input
            label="Date of Birth"
            type="date"
            required
            value={formData.dateOfBirth}
            onChange={(e) =>
              setFormData({ ...formData, dateOfBirth: e.target.value })
            }
          />
          <Select
            label="Gender"
            required
            value={formData.gender}
            onChange={(e) =>
              setFormData({ ...formData, gender: e.target.value as Gender })
            }
            options={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
            ]}
          />
        </CardContent>
      </Card>

      {/* 2. Contact & Residence */}
      <Card>
        <CardHeader
          title="2. Contact Details & Address"
          subtitle="Communication and physical residence"
        />
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone Number"
            type="tel"
            required
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            placeholder="+20 100 000 0000"
          />
          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="patient@email.com (optional)"
          />
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Street Address"
              value={formData.address.street}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, street: e.target.value },
                })
              }
              placeholder="123 Clinical Way"
            />
            <Input
              label="City"
              value={formData.address.city}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, city: e.target.value },
                })
              }
              placeholder="Cairo"
            />
            <Input
              label="Country"
              value={formData.address.country}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, country: e.target.value },
                })
              }
              placeholder="Egypt"
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Emergency Contact */}
      <Card>
        <CardHeader
          title="3. Emergency Contact"
          subtitle="Authorized relative or guardian in urgent medical situations"
        />
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Contact Full Name"
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
            placeholder="Jane Doe"
          />
          <Input
            label="Relationship"
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
            placeholder="Spouse / Parent / Sibling"
          />
          <Input
            label="Contact Phone"
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
            placeholder="+20 100 000 0000"
          />
        </CardContent>
      </Card>

      {/* 4. Clinical Indicators */}
      <Card>
        <CardHeader
          title="4. Baseline Medical Information"
          subtitle="Critical physiological baseline for clinical safety"
        />
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Blood Type"
            value={formData.bloodType}
            onChange={(e) =>
              setFormData({
                ...formData,
                bloodType: e.target.value as BloodType,
              })
            }
            placeholder="Select Blood Type"
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
            label="Known Allergies"
            value={formData.allergies}
            onChange={(e) =>
              setFormData({ ...formData, allergies: e.target.value })
            }
            placeholder="Separate multiple allergies with commas (e.g., Penicillin, Latex, Peanuts)"
            helperText="Leave empty if none reported"
          />

          <Textarea
            label="Chronic Conditions & Diseases"
            value={formData.chronicDiseases}
            onChange={(e) =>
              setFormData({ ...formData, chronicDiseases: e.target.value })
            }
            placeholder="Separate conditions with commas (e.g., Hypertension, Diabetes Type 2, Asthma)"
            helperText="Leave empty if none reported"
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
            Create Medical File
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
