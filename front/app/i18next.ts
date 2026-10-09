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

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      lng: 'ar',
      fallbackLng: 'ar',
      supportedLngs: ['ar', 'en'],
      debug: false,
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
