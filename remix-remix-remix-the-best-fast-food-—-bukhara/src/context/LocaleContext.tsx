import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { translate } from '../data/i18n';
import { STORAGE_KEYS } from '../lib/calculations';
import { Lang } from '../types';

export interface LocaleOption {
  code: Lang;
  label: string;
  nativeName: string;
}

export const SUPPORTED_LOCALES: readonly LocaleOption[] = [
  { code: 'uz', label: 'UZ', nativeName: 'O‘zbekcha' },
  { code: 'ru', label: 'RU', nativeName: 'Русский' },
  { code: 'en', label: 'EN', nativeName: 'English' },
] as const;

export function sanitizeLang(raw: unknown): Lang {
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/^"+|"+$/g, '').trim().toLowerCase();
    if (cleaned === 'en' || cleaned === 'uz' || cleaned === 'ru') {
      return cleaned;
    }
  }
  return 'uz';
}

function readInitialLang(): Lang {
  try {
    const params = new URLSearchParams(window.location.search);
    const paramLang = params.get('lang');
    if (paramLang) {
      const validParam = sanitizeLang(paramLang);
      if (validParam === paramLang.toLowerCase()) {
        return validParam;
      }
    }
    const stored = window.localStorage.getItem(STORAGE_KEYS.lang);
    if (stored) {
      try {
        return sanitizeLang(JSON.parse(stored));
      } catch {
        return sanitizeLang(stored);
      }
    }
  } catch {
    // Ignore storage access errors
  }
  return 'uz';
}

interface LocaleContextValue {
  lang: Lang;
  setLang: (next: Lang) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => readInitialLang());

  const setLang = useCallback((next: Lang) => {
    const safe = sanitizeLang(next);
    setLangState(safe);
    try {
      window.localStorage.setItem(STORAGE_KEYS.lang, JSON.stringify(safe));
    } catch {
      // Ignore quota / privacy errors
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEYS.lang, JSON.stringify(lang));
    } catch {
      // Ignore quota / privacy errors
    }
  }, [lang]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.lang && e.newValue !== null) {
        try {
          setLangState(sanitizeLang(JSON.parse(e.newValue)));
        } catch {
          setLangState(sanitizeLang(e.newValue));
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const t = useCallback((key: string) => translate(lang, key), [lang]);

  return (
    <LocaleContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LocaleContext.Provider>
  );
};

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return ctx;
}
