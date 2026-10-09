import { BaseListQueryParams } from "./api";
import { Doctor } from "./doctor";

export interface Schedule {
  _id: string;
  doctor: Doctor | string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleRequest {
  doctor: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
}

export interface UpdateScheduleRequest {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  isActive?: boolean;
}

export interface ScheduleQueryParams extends Omit<BaseListQueryParams, "search"> {
  doctor?: string;
  dayOfWeek?: number;
  isActive?: boolean;
}
