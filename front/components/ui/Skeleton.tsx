import React from "react";

export interface SkeletonProps {
  className?: string;
  variant?: "text" | "rectangular" | "circular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
}: SkeletonProps) {
  const variantStyles = {
    text: "h-3.5 w-full rounded-sm",
    rectangular: "rounded-md",
    circular: "rounded-full shrink-0",
  };

  return (
    <div
      style={{ width, height }}
      className={`animate-pulse bg-paper border border-border-subtle/50 ${variantStyles[variant]} ${className}`}
      aria-hidden="true"
    />
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-border-subtle/60">
      {Array.from({ length: columns }).map((_, idx) => (
        <td key={idx} className="p-3.5">
          <Skeleton className="h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-5 bg-surface rounded-lg border border-border-subtle flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-6 rounded-md" />
          </div>
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-32 mt-2" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
