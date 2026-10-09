"use client";

import { useEffect } from "react";
import i18n from "@/app/i18next";

export default function I18nProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const syncHtmlLang = () => {
      const lang = i18n.resolvedLanguage || i18n.language || "ar";
      document.documentElement.lang = lang;
      document.documentElement.dir = i18n.dir(lang);
      document.body.dir = i18n.dir(lang);
    };

    syncHtmlLang();
    i18n.on("languageChanged", syncHtmlLang);

    return () => {
      i18n.off("languageChanged", syncHtmlLang);
    };
  }, []);

  return <>{children}</>;
}
