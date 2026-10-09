import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { clearUser } from "@/features/auth/authSlice";
import type { ApiError } from "@/types/api";

export const getBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  return envUrl.endsWith("/api") ? envUrl : `${envUrl}/api`;
};

/**
 * Filter out undefined, null, or empty string values from query params.
 */
export function cleanQueryParams(
  params?: object | void
): Record<string, string | number | boolean> {
  if (!params || typeof params !== "object") return {};
  const cleaned: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== "") {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        cleaned[key] = value;
      }
    }
  }

  return cleaned;
}

/**
 * Lightweight Mutex to guarantee that multiple concurrent requests that encounter
 * TOKEN_EXPIRED do not trigger multiple concurrent /auth/refresh calls.
 */
class Mutex {
  private _locked = false;
  private _waiters: Array<() => void> = [];

  isLocked(): boolean {
    return this._locked;
  }

  async acquire(): Promise<() => void> {
    if (!this._locked) {
      this._locked = true;
      return () => this.release();
    }

    return new Promise<() => void>((resolve) => {
      this._waiters.push(() => {
        resolve(() => this.release());
      });
    });
  }

  async waitForUnlock(): Promise<void> {
    if (!this._locked) {
      return;
    }

    return new Promise<void>((resolve) => {
      const wait = () => {
        if (!this._locked) {
          resolve();
        } else {
          this._waiters.push(() => {
            resolve();
          });
        }
      };
      wait();
    });
  }

  private release(): void {
    if (this._waiters.length > 0) {
      const next = this._waiters.shift();
      if (next) {
        next();
      }
    } else {
      this._locked = false;
    }
  }
}

const mutex = new Mutex();
let lastRefreshSucceeded: boolean | null = null;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: getBaseUrl(),
  credentials: "include",
});

const isTokenExpiredError = (
  error: FetchBaseQueryError | undefined
): boolean => {
  if (!error || error.status !== 401) return false;
  if (typeof error.data === "object" && error.data !== null) {
    const errorData = error.data as Record<string, unknown>;
    return errorData.code === "TOKEN_EXPIRED";
  }
  return false;
};

const isAuthBypassUrl = (args: string | FetchArgs): boolean => {
  const url = typeof args === "string" ? args : args.url;
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout")
  );
};

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // Wait if a refresh is currently in progress
  await mutex.waitForUnlock();

  let result = await rawBaseQuery(args, api, extraOptions);

  // Check if token expired and request is eligible for re-authentication
  if (
    result.error &&
    result.error.status === 401 &&
    isTokenExpiredError(result.error) &&
    !isAuthBypassUrl(args)
  ) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        lastRefreshSucceeded = null;

        const refreshResult = await rawBaseQuery(
          {
            url: "/auth/refresh",
            method: "POST",
          },
          api,
          extraOptions
        );

        if (
          refreshResult.data &&
          (refreshResult.data as { success?: boolean }).success
        ) {
          lastRefreshSucceeded = true;
          // Retry the original failed request
          result = await rawBaseQuery(args, api, extraOptions);
        } else {
          lastRefreshSucceeded = false;
          api.dispatch(clearUser());
        }
      } catch {
        lastRefreshSucceeded = false;
        api.dispatch(clearUser());
      } finally {
        release();
      }
    } else {
      // Another request is actively refreshing tokens. Wait for it to complete.
      await mutex.waitForUnlock();

      // If the concurrent refresh succeeded, retry this request
      if (lastRefreshSucceeded) {
        result = await rawBaseQuery(args, api, extraOptions);
      }
    }
  }

  return result;
};

export interface ExtractedApiError {
  status: number | "FETCH_ERROR" | "PARSING_ERROR" | "TIMEOUT_ERROR" | "CUSTOM_ERROR";
  code: string;
  message: string;
  errors?: string[] | Array<{ field: string; message: string }>;
}

export function extractApiError(error: unknown): ExtractedApiError {
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;

    if ("status" in err) {
      const status = err.status as ExtractedApiError["status"];
      const data = err.data as Partial<ApiError> | undefined;

      return {
        status,
        code: data?.code || (typeof status === "number" ? `HTTP_${status}` : "NETWORK_ERROR"),
        message: data?.message || "An unexpected error occurred",
        errors: data?.errors,
      };
    }
  }

  return {
    status: "CUSTOM_ERROR",
    code: "UNKNOWN_ERROR",
    message: "An unknown error occurred",
  };
}
