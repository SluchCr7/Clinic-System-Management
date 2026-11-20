import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse, ApiMessageResponse } from "@/types/api";
import type {
  Doctor,
  DoctorAssignment,
  CreateDoctorAssignmentRequest,
  UpdateDoctorAssignmentRequest,
  DoctorAssignmentQueryParams,
} from "@/types/doctor";

export const doctorAssignmentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDoctorAssignments: builder.query<
      PaginatedResponse<DoctorAssignment>,
      DoctorAssignmentQueryParams | void
    >({
      query: (params) => ({
        url: "/doctor-assignments",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "DoctorAssignment", id: "LIST" },
              ...result.data.map(({ _id }) => ({
                type: "DoctorAssignment" as const,
                id: _id,
              })),
            ]
          : [{ type: "DoctorAssignment", id: "LIST" }],
    }),

    getMyDoctors: builder.query<ApiResponse<Doctor[]>, void>({
      query: () => ({
        url: "/doctor-assignments/my-doctors",
        method: "GET",
      }),
      providesTags: [{ type: "DoctorAssignment", id: "MY_DOCTORS" }],
    }),

    getDoctorAssignmentById: builder.query<ApiResponse<DoctorAssignment>, string>({
      query: (id) => ({
        url: `/doctor-assignments/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "DoctorAssignment", id }],
    }),

    createDoctorAssignment: builder.mutation<
      ApiResponse<DoctorAssignment>,
      CreateDoctorAssignmentRequest
    >({
      query: (body) => ({
        url: "/doctor-assignments",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "DoctorAssignment", id: "LIST" },
        { type: "DoctorAssignment", id: "MY_DOCTORS" },
        { type: "Doctor", id: "LIST" },
      ],
    }),

    updateDoctorAssignment: builder.mutation<
      ApiResponse<DoctorAssignment>,
      { id: string; data: UpdateDoctorAssignmentRequest }
    >({
      query: ({ id, data }) => ({
        url: `/doctor-assignments/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "DoctorAssignment", id },
        { type: "DoctorAssignment", id: "LIST" },
        { type: "DoctorAssignment", id: "MY_DOCTORS" },
        { type: "Doctor", id: "LIST" },
      ],
    }),

    deleteDoctorAssignment: builder.mutation<ApiMessageResponse, string>({
      query: (id) => ({
        url: `/doctor-assignments/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "DoctorAssignment", id },
        { type: "DoctorAssignment", id: "LIST" },
        { type: "DoctorAssignment", id: "MY_DOCTORS" },
        { type: "Doctor", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetDoctorAssignmentsQuery,
  useGetMyDoctorsQuery,
  useGetDoctorAssignmentByIdQuery,
  useCreateDoctorAssignmentMutation,
  useUpdateDoctorAssignmentMutation,
  useDeleteDoctorAssignmentMutation,
} = doctorAssignmentApi;
