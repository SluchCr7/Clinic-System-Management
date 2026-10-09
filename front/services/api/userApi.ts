import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse, ApiMessageResponse } from "@/types/api";
import type {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UserQueryParams,
  ProfilePhotoResponseData,
} from "@/types/user";

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<PaginatedResponse<User>, UserQueryParams | void>({
      query: (params) => ({
        url: "/users",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "User", id: "LIST" },
              ...result.data.map(({ _id }) => ({ type: "User" as const, id: _id })),
            ]
          : [{ type: "User", id: "LIST" }],
    }),

    getUserById: builder.query<ApiResponse<User>, string>({
      query: (id) => ({
        url: `/users/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "User", id }],
    }),

    createUser: builder.mutation<ApiResponse<User>, CreateUserRequest>({
      query: (body) => ({
        url: "/users",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),

    updateUser: builder.mutation<
      ApiResponse<User>,
      { id: string; data: UpdateUserRequest }
    >({
      query: ({ id, data }) => ({
        url: `/users/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    deactivateUser: builder.mutation<ApiMessageResponse, string>({
      query: (id) => ({
        url: `/users/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "User", id },
        { type: "User", id: "LIST" },
      ],
    }),

    updateProfilePhoto: builder.mutation<
      ApiResponse<ProfilePhotoResponseData>,
      FormData
    >({
      query: (formData) => ({
        url: "/users/profile-photo",
        method: "PATCH",
        body: formData,
      }),
      invalidatesTags: [{ type: "Auth", id: "ME" }],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeactivateUserMutation,
  useUpdateProfilePhotoMutation,
} = userApi;
