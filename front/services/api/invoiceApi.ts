import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  Invoice,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  InvoiceQueryParams,
} from "@/types/invoice";
import type { Visit, VisitQueryParams } from "@/types/visit";

export const invoiceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEligibleVisits: builder.query<
      PaginatedResponse<Visit>,
      VisitQueryParams | void
    >({
      query: (params) => ({
        url: "/invoices/eligible-visits",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: [
        { type: "Visit", id: "LIST" },
        { type: "Invoice", id: "LIST" },
      ],
    }),

    getInvoices: builder.query<
      PaginatedResponse<Invoice>,
      InvoiceQueryParams | void
    >({
      query: (params) => ({
        url: "/invoices",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "Invoice", id: "LIST" },
              ...result.data.map(({ _id }) => ({
                type: "Invoice" as const,
                id: _id,
              })),
            ]
          : [{ type: "Invoice", id: "LIST" }],
    }),

    getInvoiceById: builder.query<ApiResponse<Invoice>, string>({
      query: (id) => ({
        url: `/invoices/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Invoice", id }],
    }),

    createInvoice: builder.mutation<ApiResponse<Invoice>, CreateInvoiceRequest>({
      query: (body) => ({
        url: "/invoices",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, body) => [
        { type: "Invoice", id: "LIST" },
        { type: "Visit", id: body.visit },
        { type: "Visit", id: "LIST" },
        { type: "PerformedService", id: "LIST" },
        { type: "Dashboard", id: "OVERVIEW" },
        "Search",
      ],
    }),

    updateInvoice: builder.mutation<
      ApiResponse<Invoice>,
      { id: string; data: UpdateInvoiceRequest }
    >({
      query: ({ id, data }) => ({
        url: `/invoices/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Invoice", id },
        { type: "Invoice", id: "LIST" },
        { type: "Dashboard", id: "OVERVIEW" },
        "Search",
      ],
    }),

    cancelInvoice: builder.mutation<ApiResponse<Invoice>, string>({
      query: (id) => ({
        url: `/invoices/${id}/cancel`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Invoice", id },
        { type: "Invoice", id: "LIST" },
        { type: "Visit", id: "LIST" },
        { type: "Dashboard", id: "OVERVIEW" },
        "Search",
      ],
    }),
  }),
});

export const {
  useGetEligibleVisitsQuery,
  useGetInvoicesQuery,
  useGetInvoiceByIdQuery,
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
  useCancelInvoiceMutation,
} = invoiceApi;
