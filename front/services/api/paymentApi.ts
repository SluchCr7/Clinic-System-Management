import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse } from "@/types/api";
import type {
  Payment,
  CreatePaymentRequest,
  PaymentQueryParams,
} from "@/types/payment";

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
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

    createPayment: builder.mutation<ApiResponse<Payment>, CreatePaymentRequest>({
      query: (body) => ({
        url: "/payments",
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, body) => [
        { type: "Payment", id: "LIST" },
        { type: "Invoice", id: "LIST" },
        { type: "Invoice", id: body.invoice },
        { type: "Dashboard", id: "OVERVIEW" },
      ],
    }),
  }),
});

export const {
  useGetPaymentsQuery,
  useGetPaymentByIdQuery,
  useCreatePaymentMutation,
} = paymentApi;
