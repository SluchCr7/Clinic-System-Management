import { baseApi } from "./baseApi";
import { clearUser, setUser } from "@/features/auth/authSlice";
import type { ApiResponse, ApiMessageResponse } from "@/types/api";
import type {
  LoginCredentials,
  LoginResponseData,
  GetMeResponseData,
  ChangePasswordData,
} from "@/types/auth";

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<ApiResponse<LoginResponseData>, LoginCredentials>({

      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
      invalidatesTags: ["Auth"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.success) {
            // Refetch current user to populate full User object in Redux
            const meResult = await dispatch(
              authApi.endpoints.getMe.initiate(undefined, { forceRefetch: true })
            ).unwrap();

            if (meResult.success && meResult.data?.user) {
              dispatch(setUser(meResult.data.user));
            }
          }
        } catch {
          // Login failed handled by component
        }
      },
    }),

    logout: builder.mutation<ApiMessageResponse, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["Auth"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch {
          // Even if server request fails, purge client state
        } finally {
          dispatch(clearUser());
          // Clear all sensitive cached data across all entities
          dispatch(baseApi.util.resetApiState());
        }
      },
    }),

    getMe: builder.query<ApiResponse<GetMeResponseData>, void>({
      query: () => ({
        url: "/auth/me",
        method: "GET",
      }),
      providesTags: [{ type: "Auth", id: "ME" }],
    }),

    refresh: builder.mutation<ApiMessageResponse, void>({
      query: () => ({
        url: "/auth/refresh",
        method: "POST",
      }),
    }),

    changePassword: builder.mutation<ApiMessageResponse, ChangePasswordData>({
      query: (data) => ({
        url: "/auth/change-password",
        method: "PATCH",
        body: data,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useRefreshMutation,
  useChangePasswordMutation,
} = authApi;