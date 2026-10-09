"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { selectIsAuthenticated, selectIsInitialized } from "@/features/auth/authSelectors";

export default function HomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInitialized = useAppSelector(selectIsInitialized);

  useEffect(() => {
    if (!isInitialized) return;

    if (isAuthenticated) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [isInitialized, isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-teal-primary/10 border border-teal-primary/20 flex items-center justify-center animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-primary" />
        </div>
        <p className="text-xs text-slate-muted font-medium">
          {t("session.loadingOperations")}
        </p>
      </div>
    </div>
  );
}
