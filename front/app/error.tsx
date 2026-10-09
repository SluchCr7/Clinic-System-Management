"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { LuTriangleAlert, LuRefreshCw } from "react-icons/lu";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Clinical System Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-status-error-bg border border-status-error/20 flex items-center justify-center text-status-error mb-4">
        <LuTriangleAlert className="w-7 h-7 stroke-[2]" />
      </div>
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink font-sans">
        Application Error
      </h1>
      <p className="text-xs sm:text-sm text-slate-muted max-w-sm mt-2 mb-6 leading-relaxed">
        An unexpected error occurred while processing this clinical operation.
        Your session remains active.
      </p>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="md"
          onClick={() => window.location.reload()}
        >
          Reload Window
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={() => reset()}
          leftIcon={<LuRefreshCw className="w-4 h-4" />}
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}
