"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  LuBriefcaseMedical,
  LuCalendarDays,
  LuCircleAlert,
  LuFileText,
  LuReceipt,
  LuSearch,
  LuStethoscope,
  LuUsersRound,
} from "react-icons/lu";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { useGetGlobalSearchQuery } from "@/services/api/searchApi";
import type {
  GlobalSearchResult,
  GlobalSearchResultType,
} from "@/types/search";

const RESULT_GROUPS = [
  { key: "patients", type: "patient", icon: LuUsersRound, href: (id: string) => `/patients/${id}` },
  { key: "doctors", type: "doctor", icon: LuStethoscope, href: (id: string) => `/doctors/${id}` },
  { key: "appointments", type: "appointment", icon: LuCalendarDays, href: () => "/appointments" },
  { key: "invoices", type: "invoice", icon: LuReceipt, href: () => "/invoices" },
  { key: "services", type: "service", icon: LuBriefcaseMedical, href: () => "/medical-services" },
] as const;

function GlobalSearchPageContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeQuery = searchParams.get("q") ?? "";
  const [draft, setDraft] = useState({ routeQuery, query: routeQuery });
  const query = draft.routeQuery === routeQuery ? draft.query : routeQuery;
  const trimmedRouteQuery = routeQuery.trim();

  const {
    data: response,
    isFetching,
    isError,
    refetch,
  } = useGetGlobalSearchQuery(
    { q: trimmedRouteQuery, limit: 10 },
    { skip: trimmedRouteQuery.length < 2 }
  );

  const groups = response?.data.results;
  const visibleGroups = useMemo(
    () =>
      RESULT_GROUPS.flatMap((group) => {
        const items = groups?.[group.key] ?? [];
        return items.length ? [{ ...group, items }] : [];
      }),
    [groups]
  );

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = query.trim();
    if (nextQuery.length >= 2) {
      router.push(`/search?q=${encodeURIComponent(nextQuery)}`);
    }
  };

  const getResultHref = (
    type: GlobalSearchResultType,
    id: string
  ): string => {
    const group = RESULT_GROUPS.find((item) => item.type === type);
    return group ? group.href(id) : "/search";
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={t("search.title")}
        subtitle={t("search.subtitle")}
      />

      <Card>
        <CardContent>
          <form onSubmit={submitSearch} role="search" className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="global-search-query" className="sr-only">
              {t("search.inputLabel")}
            </label>
            <div className="relative flex-1">
              <LuSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-muted" />
              <input
                id="global-search-query"
                type="search"
                value={query}
                onChange={(event) =>
                  setDraft({ routeQuery, query: event.target.value })
                }
                placeholder={t("search.placeholder")}
                minLength={2}
                maxLength={100}
                className="w-full rounded-md border border-border-subtle bg-paper py-2.5 ps-10 pe-3 text-sm text-ink outline-none transition focus:border-teal-primary focus:ring-2 focus:ring-teal-primary/20"
              />
            </div>
            <Button
              type="submit"
              disabled={query.trim().length < 2}
              leftIcon={<LuSearch className="h-4 w-4" />}
            >
              {t("common.search")}
            </Button>
          </form>
          <p className="mt-2 text-xs text-slate-muted">
            {t("search.searchHint")}
          </p>
        </CardContent>
      </Card>

      {trimmedRouteQuery.length > 0 && trimmedRouteQuery.length < 2 && (
        <p className="text-sm text-status-warning" role="status">
          {t("search.minimumQuery")}
        </p>
      )}

      {trimmedRouteQuery.length >= 2 && isFetching && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item}>
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {trimmedRouteQuery.length >= 2 && isError && !isFetching && (
        <ErrorState
          title={t("search.errorTitle")}
          message={t("search.errorMessage")}
          onRetry={() => void refetch()}
        />
      )}

      {trimmedRouteQuery.length >= 2 &&
        !isFetching &&
        !isError &&
        response?.data.total === 0 && (
          <EmptyState
            title={t("search.noResultsTitle")}
            description={t("search.noResultsDescription", {
              query: trimmedRouteQuery,
            })}
            icon={<LuCircleAlert className="h-6 w-6" />}
          />
        )}

      {trimmedRouteQuery.length >= 2 &&
        !isFetching &&
        !isError &&
        response?.data.total !== undefined &&
        response.data.total > 0 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-muted">
                {t("search.resultSummary", {
                  count: response.data.total,
                  query: response.data.query,
                })}
              </p>
              <Badge variant="teal" size="sm">
                {response.data.total}
              </Badge>
            </div>

            <div className="flex flex-col gap-5">
              {visibleGroups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <Card key={group.key}>
                    <CardHeader
                      title={
                        <span className="flex items-center gap-2">
                          <GroupIcon className="h-4 w-4 text-teal-primary" />
                          {t(`search.categories.${group.key}`)}
                        </span>
                      }
                      action={
                        <Badge variant="neutral" size="sm">
                          {group.items.length}
                        </Badge>
                      }
                    />
                    <CardContent className="divide-y divide-border-subtle p-0">
                      {group.items.map((result: GlobalSearchResult) => (
                        <Link
                          key={`${result.type}-${result.id}`}
                          href={getResultHref(result.type, result.id)}
                          className="flex items-start justify-between gap-4 p-4 transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-primary"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {result.title}
                            </span>
                            {result.subtitle && (
                              <span className="mt-1 block truncate text-xs text-slate-muted">
                                {result.subtitle}
                              </span>
                            )}
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-2">
                            {result.status && (
                              <StatusBadge status={result.status} size="sm" />
                            )}
                            {result.date && (
                              <span className="text-[11px] text-slate-muted">
                                {formatDate(result.date)}
                              </span>
                            )}
                            {result.type === "service" && (
                              <LuFileText
                                className="h-4 w-4 text-slate-light"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

      {trimmedRouteQuery.length < 2 && (
        <EmptyState
          title={t("search.promptTitle")}
          description={t("search.promptDescription")}
          icon={<LuSearch className="h-6 w-6" />}
        />
      )}
    </div>
  );
}

export default function GlobalSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full" />
        </div>
      }
    >
      <GlobalSearchPageContent />
    </Suspense>
  );
}
