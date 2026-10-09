"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { usePathname, useRouter } from "next/navigation";
import { useGetUnreadCountQuery } from "@/services/api/notificationApi";
import UserMenu from "./UserMenu";
import ThemeSwitcher from "./ThemeSwitcher";
import { LuMenu, LuBell, LuX, LuArrowRight } from "react-icons/lu";
import { CiSearch } from "react-icons/ci";

interface HeaderProps {
  onOpenMobileSidebar: () => void;
}

export default function Header({ onOpenMobileSidebar }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: unreadData } = useGetUnreadCountQuery(undefined, {
    pollingInterval: 60000,
  });

  const unreadCount = unreadData?.data?.unreadCount || 0;

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query.length >= 2) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setIsSearchOpen(false);
      setSearchQuery("");
    }
  };

  const breadcrumbMap: Record<string, string> = {
    dashboard: t("nav.dashboard"),
    patients: t("nav.patients"),
    doctors: t("nav.doctors"),
    appointments: t("nav.appointments"),
    visits: t("nav.visits"),
    prescriptions: t("nav.prescriptions"),
    "lab-orders": t("nav.labOrders"),
    invoices: t("nav.invoices"),
    payments: t("nav.payments"),
    "medical-services": t("nav.medicalServices"),
    reports: t("nav.reports"),
    users: t("nav.staffUsers"),
    "audit-logs": t("nav.auditLogs"),
    notifications: t("nav.notifications"),
    settings: t("nav.settings"),
  };

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const label = breadcrumbMap[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
    return { href, label, isLast: idx === segments.length - 1 };
  });

  return (
    <header className="h-16 px-4 sm:px-6 bg-surface border-b border-border-subtle flex items-center justify-between gap-4 sticky top-0 z-30 select-none">
      {/* الجانب الأيسر: زر القائمة ومسار التنقل (Breadcrumbs) - يتم إخفاؤه مؤقتاً عند فتح البحث في الشاشات الصغيرة */}
      <div className={`flex items-center gap-3 ${isSearchOpen ? "hidden sm:flex" : "flex"}`}>
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden text-slate-muted hover:text-ink p-1.5 rounded-md hover:bg-paper transition-colors"
          aria-label={t("header.openMenu")}
        >
          <LuMenu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          <Link
            href="/dashboard"
            className="text-slate-muted hover:text-ink transition-colors font-medium"
          >
            {t("header.home")}
          </Link>
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.href}>
              <span className="text-slate-light">/</span>
              {crumb.isLast ? (
                <span className="font-semibold text-ink">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-slate-muted hover:text-ink transition-colors font-medium"
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* حقل البحث المتمدد (Expandable Search Bar) */}
      {isSearchOpen && (
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="flex-1 flex items-center gap-2 animate-fadeIn transition-all duration-200"
        >
          <div className="relative w-full flex items-center">
            <CiSearch className="absolute start-3 w-4 h-4 text-slate-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              minLength={2}
              maxLength={100}
              placeholder={t("header.searchPlaceholder")}
              className="w-full bg-paper text-ink text-xs sm:text-sm rounded-lg ps-9 pe-10 py-2 border border-border-subtle focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              className="absolute end-2.5 text-slate-muted hover:text-ink p-1 rounded-md transition-colors"
              aria-label={t("common.close")}
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>
          <button
            type="submit"
            disabled={searchQuery.trim().length < 2}
            className="shrink-0 p-2 rounded-lg text-teal-primary hover:bg-paper disabled:opacity-40 disabled:pointer-events-none transition-colors"
            aria-label={t("header.submitSearch")}
            title={t("header.submitSearch")}
          >
            <LuArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </form>
      )}

      {/* الأيقونات والخيارات في جهة اليمين */}
      <div className={`flex items-center gap-1.5 sm:gap-2 ${isSearchOpen ? "hidden sm:flex" : "flex"}`}>
        <ThemeSwitcher />

        <Link
          href="/notifications"
          className="relative p-2 rounded-lg text-slate-muted hover:text-ink hover:bg-paper transition-colors"
          aria-label={t("header.notifications")}
        >
          <LuBell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-status-error ring-2 ring-surface" />
          )}
        </Link>

        {/* زر تفعيل البحث */}
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="relative p-2 rounded-lg text-slate-muted hover:text-ink hover:bg-paper transition-colors"
          aria-label={t("header.search")}
        >
          <CiSearch className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-border-subtle" aria-hidden="true" />

        <UserMenu />
      </div>
    </header>
  );
}