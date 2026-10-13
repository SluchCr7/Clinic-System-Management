export type DashboardReportPeriod =
  | "today"
  | "week"
  | "month"
  | "year"
  | "custom";

export interface DashboardReportQuery {
  period?: DashboardReportPeriod;
  startDate?: string;
  endDate?: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface DashboardOverview {
  overview: {
    totalPatients: number;
    activePatients: number;
    inactivePatients: number;
    totalDoctors: number;
    activeDoctors: number;
    inactiveDoctors: number;
    totalAppointments: number;
    todayAppointments: number;
    completedVisits: number;
  };
  appointments: {
    scheduled: number;
    confirmed: number;
    checkedIn?: number;
    inProgress?: number;
    completed: number;
    cancelled: number;
    noShow: number;
    today: {
      scheduled: number;
      confirmed: number;
      checkedIn?: number;
      inProgress?: number;
      completed: number;
      cancelled: number;
      noShow: number;
    };
  };
  financial: {
    totalInvoiced: number;
    totalCollected: number;
    totalOutstanding: number;
    todayRevenue: number;
    invoices: {
      unpaid: number;
      partiallyPaid: number;
      paid: number;
      cancelled: number;
    };
  };
  labOrders: {
    pending: number;
    processing: number;
    completed: number;
    cancelled: number;
  };
}

export interface RevenueReport {
  period: string;
  range: DateRange;
  totalRevenue: number;
  totalInvoiced: number;
  totalOutstanding: number;
  dailyRevenue: Array<{
    date: string;
    revenue: number;
  }>;
}

export interface AppointmentsReport {
  period: string;
  range: DateRange;
  totalAppointments: number;
  byStatus: Record<string, number>;
  dailyAppointments: Array<{
    date: string;
    count: number;
  }>;
}

export interface PatientsReport {
  period: string;
  range: DateRange;
  totalNewPatients: number;
  activePatients: number;
  inactivePatients: number;
  dailyPatients: Array<{
    date: string;
    count: number;
  }>;
  patientsByGender: Record<string, number>;
  patientsByAgeGroup: Record<string, number>;
}

export interface DoctorPerformance {
  doctorId: string;
  doctorName: string;
  specialization: string;
  appointmentCount: number;
  visitCount: number;
  revenueGenerated: number;
}

export interface DoctorsReport {
  period: string;
  range: DateRange;
  totalDoctors: number;
  activeDoctors: number;
  doctorPerformance: DoctorPerformance[];
}

export interface LabOrdersReport {
  period: string;
  range: DateRange;
  totalOrders: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  topTests: Array<{
    name: string;
    count: number;
  }>;
}

export interface PaymentsReport {
  period: string;
  range: DateRange;
  totalCollected: number;
  totalTransactions: number;
  byMethod: Record<string, number>;
  dailyPayments: Array<{
    date: string;
    amount: number;
  }>;
}

export interface MedicalServicesReport {
  period: string;
  range: DateRange;
  totalPerformed: number;
  totalRevenue: number;
  topServices: Array<{
    serviceId: string;
    name: string;
    count: number;
    revenue: number;
  }>;
  byCategory: Record<string, { count: number; revenue: number }>;
}
