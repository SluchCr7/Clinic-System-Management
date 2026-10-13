'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '@/public/locales/en/translation.json';
import ar from '@/public/locales/ar/translation.json';

const resources = {
  en: { translation: en },
  ar: { translation: ar },
};

const missingKeyFallback = (key: string) => {
  const leafKey = key.split(".").pop() || "unavailable";
  const label = leafKey
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  return label.length > 32 ? `${label.slice(0, 29).trimEnd()}...` : label;
};

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      lng: 'ar',
      fallbackLng: 'en',
      supportedLngs: ['ar', 'en'],
      debug: false,
      parseMissingKeyHandler: (key) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[i18n] Missing translation key: "${key}"`);
        }

        return missingKeyFallback(key);
      },
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ['localStorage', 'htmlTag', 'navigator'],
        caches: ['localStorage'],
      },
      react: {
        useSuspense: false,
      },
    });
}

export default i18n;
