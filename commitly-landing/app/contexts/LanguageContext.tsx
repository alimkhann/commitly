'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { Language, translations, languageNames } from '../lib/translations'

const fallbackLanguage: Language = 'en'

const regionLanguageMap: Record<string, Language> = {
  RU: 'ru',
  CN: 'zh-TW',
  TW: 'zh-TW',
  HK: 'en',
  KZ: 'kz',
}

const baseLanguageMap: Record<string, Language> = {
  ru: 'ru',
  kk: 'kz',
  kz: 'kz',
  zh: 'zh-TW',
}

function detectLanguagePreference(): Language {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return fallbackLanguage
  }

  const localeCandidates = navigator.languages?.length
    ? navigator.languages
    : navigator.language
      ? [navigator.language]
      : []

  for (const rawLocale of localeCandidates) {
    if (!rawLocale) continue
    const normalized = rawLocale.replace('_', '-').trim()
    if (!normalized) continue

    const [basePart, regionPart] = normalized.split('-')

    if (regionPart) {
      const regionLang = regionLanguageMap[regionPart.toUpperCase()]
      if (regionLang) return regionLang
    }

    if (basePart) {
      const baseLang = baseLanguageMap[basePart.toLowerCase()]
      if (baseLang) return baseLang
    }
  }

  return fallbackLanguage
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: typeof translations.en
  languageNames: typeof languageNames
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language | null
    if (savedLanguage && translations[savedLanguage]) {
      setLanguageState(savedLanguage)
      return
    }

    const detectedLanguage = detectLanguagePreference()
    setLanguageState(detectedLanguage)
    localStorage.setItem('language', detectedLanguage)
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('language', lang)
  }

  const t = translations[language]

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languageNames }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
