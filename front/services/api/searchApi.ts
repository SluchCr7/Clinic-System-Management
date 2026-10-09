import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse } from "@/types/api";
import type { GlobalSearchParams, GlobalSearchResponse } from "@/types/search";

export const searchApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getGlobalSearch: builder.query<
      ApiResponse<GlobalSearchResponse>,
      GlobalSearchParams
    >({
      query: (params) => ({
        url: "/search",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: ["Search"],
    }),
  }),
});

export const { useGetGlobalSearchQuery } = searchApi;
