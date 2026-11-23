import { baseApi } from "./baseApi";
import type { ApiResponse } from "@/types/api";
import type { OwnerClinicView, StaffClinicView } from "@/types/clinic";

export type MyClinicView = OwnerClinicView | StaffClinicView;

export const clinicApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyClinic: builder.query<ApiResponse<MyClinicView>, void>({
      query: () => ({
        url: "/clinics/me",
        method: "GET",
      }),
      providesTags: [{ type: "Clinic", id: "ME" }],
    }),
    updateMyClinic: builder.mutation<
      ApiResponse<OwnerClinicView>,
      Partial<Omit<OwnerClinicView, "id" | "owner_doctor_id">> & {
        syncDoctorSchedule?: boolean;
      }
    >({
      query: (body) => ({
        url: "/clinics/me",
        method: "PATCH",
        body,
      }),
      invalidatesTags: [
        { type: "Clinic", id: "ME" },
        { type: "Schedule", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetMyClinicQuery,
  useUpdateMyClinicMutation,
} = clinicApi;
