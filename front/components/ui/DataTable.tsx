import React from "react";
import { TableRowSkeleton } from "./Skeleton";
import { EmptyState, ErrorState } from "./EmptyState";
import {
  LuChevronLeft,
  LuChevronRight,
  LuArrowUpDown,
  LuArrowUp,
  LuArrowDown,
} from "react-icons/lu";
import type { Pagination as PaginationType } from "@/types/api";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data?: T[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  pagination?: PaginationType;
  onPageChange?: (page: number) => void;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T extends { _id?: string; id?: string }>({
  columns,
  data = [],
  isLoading = false,
  isError = false,
  onRetry,
  emptyTitle = "No records found",
  emptyDescription = "There are currently no items in this list.",
  emptyActionLabel,
  onEmptyAction,
  pagination,
  onPageChange,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
  className = "",
}: DataTableProps<T>) {
  if (isError) {
    return <ErrorState onRetry={onRetry} className={className} />;
  }

  return (
    <div
      className={`bg-surface rounded-lg border border-border-subtle shadow-subtle overflow-hidden flex flex-col ${className}`}
    >
      <div className="w-full overflow-x-auto">
        <table className="w-full text-start text-xs text-ink border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-paper/75 border-b border-border-subtle">
              {columns.map((col) => {
                const isSorted = sortBy === col.key;
                const alignClass =
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-start";

                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`py-3 px-4 font-semibold text-[11px] uppercase tracking-wider text-slate-muted select-none ${alignClass} ${
                      col.className || ""
                    }`}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-ink transition-colors focus:outline-none"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortOrder === "asc" ? (
                            <LuArrowUp className="w-3 h-3 text-teal-primary" />
                          ) : (
                            <LuArrowDown className="w-3 h-3 text-teal-primary" />
                          )
                        ) : (
                          <LuArrowUpDown className="w-3 h-3 text-slate-light" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/60">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <TableRowSkeleton key={idx} columns={columns.length} />
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    actionLabel={emptyActionLabel}
                    onAction={onEmptyAction}
                    className="border-none rounded-none py-12"
                  />
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const rowKey = row._id || row.id || String(idx);
                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors duration-100 ${
                      onRowClick
                        ? "cursor-pointer hover:bg-paper/60"
                        : "hover:bg-paper/30"
                    }`}
                  >
                    {columns.map((col) => {
                      const alignClass =
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-start";

                      return (
                        <td
                          key={col.key}
                          className={`py-3.5 px-4 text-xs ${alignClass} ${
                            col.className || ""
                          }`}
                        >
                          {col.render
                            ? col.render(row)
                            : (row as Record<string, unknown>)[col.key] !==
                              undefined
                            ? String((row as Record<string, unknown>)[col.key])
                            : "-"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && onPageChange && (
        <div className="p-3.5 border-t border-border-subtle bg-paper/40 flex items-center justify-between gap-4 text-xs text-slate-muted">
          <div>
            Showing{" "}
            <span className="font-semibold text-ink">
              {Math.min(
                (pagination.page - 1) * pagination.limit + 1,
                pagination.total
              )}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-ink">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            of <span className="font-semibold text-ink">{pagination.total}</span>{" "}
            entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!pagination.hasPrevPage || isLoading}
              onClick={() => onPageChange(pagination.page - 1)}
              className="p-1.5 rounded-md border border-border-subtle bg-surface text-ink hover:bg-paper disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Previous page"
            >
              <LuChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 py-1 text-xs font-medium text-ink">
              {pagination.page} / {pagination.pages || 1}
            </span>

            <button
              type="button"
              disabled={!pagination.hasNextPage || isLoading}
              onClick={() => onPageChange(pagination.page + 1)}
              className="p-1.5 rounded-md border border-border-subtle bg-surface text-ink hover:bg-paper disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Next page"
            >
              <LuChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
