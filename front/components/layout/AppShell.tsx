"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { selectIsAuthenticated, selectIsInitialized } from "@/features/auth/authSelectors";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Drawer from "@/components/ui/Drawer";

export interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInitialized = useAppSelector(selectIsInitialized);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isInitialized, isAuthenticated, router]);

  if (!isInitialized || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-teal-primary/10 border border-teal-primary/20 flex items-center justify-center animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-primary" />
          </div>
          <p className="text-xs text-slate-muted font-medium">
            {t("session.verifying")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex text-ink">
      <div className="hidden lg:block shrink-0 sticky top-0 h-screen z-40">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      <Drawer
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        position="left"
        size="sm"
        className="p-0 border-none"
      >
        <div className="h-full">
          <Sidebar
            isCollapsed={false}
            onToggleCollapse={() => {}}
            onCloseMobile={() => setIsMobileOpen(false)}
          />
        </div>
      </Drawer>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header onOpenMobileSidebar={() => setIsMobileOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
