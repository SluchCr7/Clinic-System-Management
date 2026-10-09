export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface ApiMessageResponse {
  success: boolean;
  message: string;
}

export interface ApiError {
  success: false;
  code: string;
  message: string;
  errors?: string[] | Array<{ field: string; message: string }>;
  stack?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: Pagination;
}

export interface BaseListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}
