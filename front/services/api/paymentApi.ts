import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  Payment,
  PaymentMethodItem,
  CreatePaymentRequest,
  PaymentQueryParams,
  DailyClosingReport,
} from "@/types/payment";

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPaymentMethods: builder.query<ApiResponse<PaymentMethodItem[]>, void>({
      query: () => ({
        url: "/payment-methods",
        method: "GET",
      }),
      providesTags: [{ type: "PaymentMethod", id: "LIST" }],
    }),

    getPayments: builder.query<
      PaginatedResponse<Payment>,
      PaymentQueryParams | void
    >({
      query: (params) => ({
        url: "/payments",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "Payment", id: "LIST" },
              ...result.data.map(({ _id }) => ({
                type: "Payment" as const,
                id: _id,
              })),
            ]
          : [{ type: "Payment", id: "LIST" }],
    }),

    getPaymentById: builder.query<ApiResponse<Payment>, string>({
      query: (id) => ({
        url: `/payments/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "Payment", id }],
    }),

    getDailyClosing: builder.query<
      ApiResponse<DailyClosingReport>,
      { date?: string; startDate?: string; endDate?: string } | void
    >({
      query: (params) => ({
        url: "/payments/daily-closing",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: [{ type: "Payment", id: "DAILY_CLOSING" }],
    }),

    createPayment: builder.mutation<ApiResponse<Payment>, CreatePaymentRequest>({
      query: (body) => ({
        url: `/invoices/${body.invoice}/payments`,
        method: "POST",
        headers: body.idempotencyKey
          ? { "Idempotency-Key": body.idempotencyKey }
          : undefined,
        body,
      }),
      invalidatesTags: (_result, _error, body) => [
        { type: "Payment", id: "LIST" },
        { type: "Payment", id: "DAILY_CLOSING" },
        { type: "Invoice", id: "LIST" },
        { type: "Invoice", id: body.invoice },
        { type: "Dashboard", id: "OVERVIEW" },
        { type: "Dashboard", id: "PAYMENTS_REPORT" },
      ],
    }),

    reversePayment: builder.mutation<
      ApiResponse<Payment>,
      { id: string; reason: string }
    >({
      query: ({ id, reason }) => ({
        url: `/payments/${id}/reverse`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Payment", id: "LIST" },
        { type: "Payment", id },
        { type: "Payment", id: "DAILY_CLOSING" },
        { type: "Invoice", id: "LIST" },
        { type: "Dashboard", id: "OVERVIEW" },
        { type: "Dashboard", id: "PAYMENTS_REPORT" },
      ],
    }),
  }),
});

export const {
  useGetPaymentMethodsQuery,
  useGetPaymentsQuery,
  useGetPaymentByIdQuery,
  useGetDailyClosingQuery,
  useCreatePaymentMutation,
  useReversePaymentMutation,
} = paymentApi;
