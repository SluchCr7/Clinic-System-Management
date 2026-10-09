export type GlobalSearchResultType =
  | "patient"
  | "doctor"
  | "appointment"
  | "invoice"
  | "service";

export interface GlobalSearchResult {
  type: GlobalSearchResultType;
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  date?: string;
}

export interface GlobalSearchResults {
  patients: GlobalSearchResult[];
  doctors: GlobalSearchResult[];
  appointments: GlobalSearchResult[];
  invoices: GlobalSearchResult[];
  services: GlobalSearchResult[];
}

export interface GlobalSearchResponse {
  query: string;
  results: GlobalSearchResults;
  total: number;
}

export interface GlobalSearchParams {
  q: string;
  limit?: number;
}
