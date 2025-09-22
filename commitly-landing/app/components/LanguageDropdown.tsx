'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { Language } from '../lib/translations'

interface LanguageDropdownProps {
    variant?: 'navbar' | 'footer'
}

export default function LanguageDropdown({ variant = 'navbar' }: LanguageDropdownProps) {
    const { language, setLanguage, languageNames } = useLanguage()
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const languages: Language[] = ['en', 'zh-TW', 'kz', 'ru']

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const isFooter = variant === 'footer'

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1 transition-colors ${
                    isFooter 
                        ? 'px-2 py-1 text-xs text-[#d9d9d9] hover:text-white hover:underline underline-offset-2' 
                        : 'px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-white/20 rounded-md hover:bg-white/10'
                }`}
            >
                <span>{languageNames[language]}</span>
                <svg
                    className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-1 w-32 bg-black/90 backdrop-blur-sm border border-white/20 rounded-md shadow-lg z-50">
                    {languages.map((lang) => (
                        <button
                            key={lang}
                            onClick={() => {
                                setLanguage(lang)
                                setIsOpen(false)
                            }}
                            className={`w-full px-3 py-2 text-left text-xs sm:text-sm hover:bg-white/10 transition-colors first:rounded-t-md last:rounded-b-md ${
                                language === lang ? 'bg-white/20' : ''
                            }`}
                        >
                            {languageNames[lang]}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
