"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { selectCurrentUser } from "@/features/auth/authSelectors";
import { useLogoutMutation } from "@/services/api/authApi";
import { Avatar, StatusBadge } from "@/components/ui";
import {
  LuUser,
  LuSettings,
  LuKeyRound,
  LuLogOut,
  LuChevronDown,
} from "react-icons/lu";

export default function UserMenu() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAppSelector(selectCurrentUser);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Handled by onQueryStarted which purges Redux + cache
    } finally {
      router.push("/login");
    }
  };

  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-paper transition-colors focus:outline-none focus:ring-2 focus:ring-teal-primary/20"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Avatar src={user.profilePhoto?.url} name={fullName} size="sm" />
        <div className="hidden md:flex flex-col text-start">
          <span className="text-xs font-semibold text-ink leading-tight">
            {fullName}
          </span>
          <span className="text-[10px] text-slate-muted capitalize leading-none mt-0.5">
            {user.role}
          </span>
        </div>
        <LuChevronDown className="w-3.5 h-3.5 text-slate-light hidden md:block" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute end-0 mt-2 w-56 bg-surface rounded-xl border border-border-subtle shadow-dialog py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-4 py-2.5 border-b border-border-subtle flex flex-col gap-1">
            <p className="text-xs font-semibold text-ink leading-tight">
              {fullName}
            </p>
            <p className="text-[11px] text-slate-muted truncate">
              {user.email}
            </p>
            <div className="mt-1">
              <StatusBadge status={user.role} size="sm" />
            </div>
          </div>

          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink hover:bg-paper transition-colors"
              role="menuitem"
            >
              <LuUser className="w-4 h-4 text-slate-muted" />
              <span>{t("common.profile")}</span>
            </Link>

            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink hover:bg-paper transition-colors"
              role="menuitem"
            >
              <LuSettings className="w-4 h-4 text-slate-muted" />
              <span>{t("common.settings")}</span>
            </Link>

            <Link
              href="/settings?tab=security"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs text-ink hover:bg-paper transition-colors"
              role="menuitem"
            >
              <LuKeyRound className="w-4 h-4 text-slate-muted" />
              <span>{t("settings.securityTitle")}</span>
            </Link>
          </div>

          <div className="pt-1 border-t border-border-subtle">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-status-error hover:bg-status-error-bg/50 transition-colors text-start disabled:opacity-50"
              role="menuitem"
            >
              <LuLogOut className="w-4 h-4" />
              <span>{isLoggingOut ? "Signing out..." : t("common.signOut")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
