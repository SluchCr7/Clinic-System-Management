"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useLoginMutation } from "@/services/api/authApi";
import { useAppSelector } from "@/redux/hooks";
import { selectIsAuthenticated } from "@/features/auth/authSelectors";
import { Button, Input, Logo } from "@/components/ui";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";
import { extractApiError } from "@/services/api/baseQuery";
import { LuMail, LuLock, LuShieldCheck, LuCircleAlert } from "react-icons/lu";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage(t("auth.login.validation.missingCredentials"));
      return;
    }

    try {
      const res = await login({ email, password }).unwrap();
      if (res.success) {
        router.replace("/dashboard");
      }
    } catch (err) {
      const extracted = extractApiError(err);
      if (extracted.code === "INVALID_CREDENTIALS") {
        setErrorMessage(t("auth.login.validation.invalidCredentials"));
      } else if (extracted.code === "ACCOUNT_INACTIVE") {
        setErrorMessage(t("auth.login.validation.inactiveAccount"));
      } else if (extracted.code === "AUTH_RATE_LIMIT_EXCEEDED") {
        setErrorMessage(t("auth.login.validation.rateLimit"));
      } else {
        setErrorMessage(extracted.message || t("auth.login.validation.signInFailed"));
      }
    }
  };

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 end-4">
        <ThemeSwitcher />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>
        <h2 className="text-center text-xl sm:text-2xl font-bold tracking-tight text-ink font-sans">
          {t("auth.login.title")}
        </h2>
        <p className="mt-1.5 text-center text-xs text-slate-muted">
          {t("auth.login.subtitle")}
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface py-7 px-5 sm:px-8 rounded-xl border border-border-subtle shadow-card">
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-md bg-status-error-bg border border-status-error/20 flex items-start gap-2.5 text-xs text-status-error"
            >
              <LuCircleAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label={t("auth.login.emailLabel")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.login.emailPlaceholder")}
              leftIcon={<LuMail className="w-4 h-4" />}
              required
              autoComplete="email"
            />

            <Input
              label={t("auth.login.passwordLabel")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.login.passwordPlaceholder")}
              leftIcon={<LuLock className="w-4 h-4" />}
              required
              autoComplete="current-password"
            />

            <div className="mt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                isLoading={isLoading}
              >
                {t("auth.login.signIn")}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-border-subtle/80">
            <p className="text-[11px] font-medium text-slate-muted mb-2 text-center">
              {t("auth.login.quickCredentials")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill("admin@clinic.com")}
                className="p-1.5 rounded-md border border-border-subtle bg-paper/50 hover:bg-mint hover:border-teal-primary/30 text-[11px] font-medium text-slate-dark transition-colors"
              >
                {t("auth.login.quickFillAdmin")}
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("doctor@clinic.com")}
                className="p-1.5 rounded-md border border-border-subtle bg-paper/50 hover:bg-mint hover:border-teal-primary/30 text-[11px] font-medium text-slate-dark transition-colors"
              >
                {t("auth.login.quickFillDoctor")}
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("receptionist@clinic.com")}
                className="p-1.5 rounded-md border border-border-subtle bg-paper/50 hover:bg-mint hover:border-teal-primary/30 text-[11px] font-medium text-slate-dark transition-colors"
              >
                {t("auth.login.quickFillReceptionist")}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-muted">
          <LuShieldCheck className="w-4 h-4 text-teal-primary" />
          <span>{t("auth.login.securityText")}</span>
        </div>
      </div>
    </div>
  );
}
