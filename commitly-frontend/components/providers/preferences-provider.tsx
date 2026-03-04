"use client";

import { useAuth } from "@clerk/nextjs";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type AppLanguage, languageNames, tForLanguage, type TranslationKey } from "@/lib/i18n/translations";
import { repoService } from "@/lib/services/repos";

type ThemeMode = "system" | "light" | "dark";

type PreferencesContextValue = {
  theme: ThemeMode;
  language: AppLanguage;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: TranslationKey, fallback?: string) => string;
  languageNames: Record<AppLanguage, string>;
  saving: boolean;
};

const STORAGE_THEME_KEY = "commitly.theme";
const STORAGE_LANGUAGE_KEY = "commitly.language";

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function normalizeTheme(value: string | null): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

function normalizeLanguage(value: string | null): AppLanguage {
  if (value === "en" || value === "zh-HK" || value === "kz" || value === "ru") {
    return value;
  }
  return "en";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [language, setLanguageState] = useState<AppLanguage>("en");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedTheme = normalizeTheme(localStorage.getItem(STORAGE_THEME_KEY));
    const storedLanguage = normalizeLanguage(localStorage.getItem(STORAGE_LANGUAGE_KEY));
    setThemeState(storedTheme);
    setLanguageState(storedLanguage);
    setHydrated(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.classList.toggle("dark", resolved === "dark");
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    const onChange = () => apply();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isSignedIn) {
        return;
      }
      const token = await getToken?.();
      const response = await repoService.getPreferences(token ?? undefined);
      if (!(response.ok && response.data) || cancelled) {
        return;
      }
      const nextTheme = normalizeTheme(response.data.theme ?? null);
      const nextLanguage = normalizeLanguage(response.data.language ?? null);
      setThemeState(nextTheme);
      setLanguageState(nextLanguage);
      localStorage.setItem(STORAGE_THEME_KEY, nextTheme);
      localStorage.setItem(STORAGE_LANGUAGE_KEY, nextLanguage);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  const persist = useCallback(
    async (nextTheme: ThemeMode, nextLanguage: AppLanguage) => {
      localStorage.setItem(STORAGE_THEME_KEY, nextTheme);
      localStorage.setItem(STORAGE_LANGUAGE_KEY, nextLanguage);
      if (!isSignedIn) {
        return;
      }
      setSaving(true);
      try {
        const token = await getToken?.();
        await repoService.updatePreferences(
          {
            theme: nextTheme,
            language: nextLanguage,
          },
          token ?? undefined
        );
      } finally {
        setSaving(false);
      }
    },
    [getToken, isSignedIn]
  );

  const setTheme = useCallback(
    async (nextTheme: ThemeMode) => {
      setThemeState(nextTheme);
      await persist(nextTheme, language);
    },
    [language, persist]
  );

  const setLanguage = useCallback(
    async (nextLanguage: AppLanguage) => {
      setLanguageState(nextLanguage);
      await persist(theme, nextLanguage);
    },
    [persist, theme]
  );

  const t = useCallback(
    (key: TranslationKey, fallback?: string) =>
      tForLanguage(hydrated ? language : "en", key, fallback),
    [hydrated, language]
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      theme,
      language,
      setTheme,
      setLanguage,
      t,
      languageNames,
      saving,
    }),
    [theme, language, setTheme, setLanguage, t, saving]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
