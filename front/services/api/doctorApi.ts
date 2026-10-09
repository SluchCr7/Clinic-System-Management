import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse, ApiMessageResponse } from "@/types/api";
import type {
  Doctor,
  CreateDoctorRequest,
  UpdateDoctorRequest,
  DoctorQueryParams,
} from "@/types/doctor";

export const doctorApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDoctors: builder.query<PaginatedResponse<Doctor>, DoctorQueryParams | void>({
      query: (params) => ({
        url: "/doctors",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "Doctor", id: "LIST" },
              ...result.data.map(({ _id }) => ({ type: "Doctor" as const, id: _id })),
            ]
          : [{ type: "Doctor", id: "LIST" }],
    }),

    getDoctorById: builder.query<ApiResponse<Doctor>, string>({
      query: (id) => ({
        url: `/doctors/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Doctor", id }],
    }),

    createDoctor: builder.mutation<ApiResponse<Doctor>, CreateDoctorRequest>({
      query: (body) => ({
        url: "/doctors",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Doctor", id: "LIST" },
        "Search",
      ],
    }),

    updateDoctor: builder.mutation<
      ApiResponse<Doctor>,
      { id: string; data: UpdateDoctorRequest }
    >({
      query: ({ id, data }) => ({
        url: `/doctors/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Doctor", id },
        { type: "Doctor", id: "LIST" },
        "Search",
      ],
    }),

    deactivateDoctor: builder.mutation<ApiMessageResponse, string>({
      query: (id) => ({
        url: `/doctors/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Doctor", id },
        { type: "Doctor", id: "LIST" },
        "Search",
      ],
    }),
  }),
});

export const {
  useGetDoctorsQuery,
  useGetDoctorByIdQuery,
  useCreateDoctorMutation,
  useUpdateDoctorMutation,
  useDeactivateDoctorMutation,
} = doctorApi;
