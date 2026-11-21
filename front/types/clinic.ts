export interface ClinicWorkingHoursDay {
  open: string | null;
  close: string | null;
  closed: boolean;
  emergency: boolean;
}

export interface OwnerClinicView {
  id: string;
  name: string;
  license_number: string | null;
  slot_duration_minutes: number;
  currency: string;
  tax_note: string | null;
  working_hours: Record<string, ClinicWorkingHoursDay>;
  owner_doctor_id: string;
}

export interface StaffClinicView {
  id: string;
  name: string;
  doctor: {
    id: string;
    name: string;
  } | null;
}
