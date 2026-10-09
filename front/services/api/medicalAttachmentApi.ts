import { baseApi } from "./baseApi";
import { cleanQueryParams } from "./baseQuery";
import type { ApiResponse, PaginatedResponse, ApiMessageResponse } from "@/types/api";
import type {
  MedicalAttachment,
  MedicalAttachmentQueryParams,
} from "@/types/medicalAttachment";

export const medicalAttachmentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMedicalAttachments: builder.query<
      PaginatedResponse<MedicalAttachment>,
      MedicalAttachmentQueryParams
    >({
      query: (params) => ({
        url: "/medical-attachments",
        method: "GET",
        params: cleanQueryParams(params),
      }),
      providesTags: (result) =>
        result
          ? [
              { type: "MedicalAttachment", id: "LIST" },
              ...result.data.map(({ _id }) => ({
                type: "MedicalAttachment" as const,
                id: _id,
              })),
            ]
          : [{ type: "MedicalAttachment", id: "LIST" }],
    }),

    getMedicalAttachmentById: builder.query<
      ApiResponse<MedicalAttachment>,
      string
    >({
      query: (id) => ({
        url: `/medical-attachments/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [{ type: "MedicalAttachment", id }],
    }),

    createMedicalAttachment: builder.mutation<
      ApiResponse<MedicalAttachment>,
      FormData
    >({
      query: (formData) => ({
        url: "/medical-attachments",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: [{ type: "MedicalAttachment", id: "LIST" }],
    }),

    deleteMedicalAttachment: builder.mutation<ApiMessageResponse, string>({
      query: (id) => ({
        url: `/medical-attachments/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: "MedicalAttachment", id },
        { type: "MedicalAttachment", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetMedicalAttachmentsQuery,
  useGetMedicalAttachmentByIdQuery,
  useCreateMedicalAttachmentMutation,
  useDeleteMedicalAttachmentMutation,
} = medicalAttachmentApi;
