'use client'

import Image from 'next/image'
import { useState } from 'react'

interface SettingsProps {
  onClose: () => void
}

type SettingsSection = 'general' | 'notifications' | 'security' | 'account'

export default function Settings({ onClose }: SettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')

  const settingsSections = [
    { id: 'general' as const, name: 'General', icon: '/icons/settings.svg' },
    { id: 'notifications' as const, name: 'Notifications', icon: '/icons/help.svg' }, // Using help icon as placeholder
    { id: 'security' as const, name: 'Security', icon: '/icons/help.svg' }, // Using help icon as placeholder
    { id: 'account' as const, name: 'Account', icon: '/icons/profile.svg' }
  ]

  const renderSettingsContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-4">
            {/* Theme Setting */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-[32px]">
                Theme
              </p>
              <div className="flex gap-2.5 items-center justify-center">
                <p className="font-teachers font-normal text-white text-[24px]">
                  System
                </p>
                <div className="w-5 h-3 flex items-center justify-center">
                  <Image
                    src="/icons/collapse.svg"
                    alt="Dropdown"
                    width={20}
                    height={12}
                    className="w-5 h-3"
                  />
                </div>
              </div>
            </div>

            {/* Language Setting */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-[32px]">
                Language
              </p>
              <div className="flex gap-2.5 items-center justify-center">
                <p className="font-teachers font-normal text-white text-[24px]">
                  Auto-detect
                </p>
                <div className="w-5 h-3 flex items-center justify-center">
                  <Image
                    src="/icons/collapse.svg"
                    alt="Dropdown"
                    width={20}
                    height={12}
                    className="w-5 h-3"
                  />
                </div>
              </div>
            </div>
          </div>
        )
      
      case 'notifications':
        return (
          <div className="space-y-4">
            <p className="font-teachers font-normal text-white text-[32px]">
              Notification Settings
            </p>
            <p className="font-teachers font-normal text-white/70 text-[20px]">
              Configure your notification preferences here.
            </p>
          </div>
        )
      
      case 'security':
        return (
          <div className="space-y-4">
            <p className="font-teachers font-normal text-white text-[32px]">
              Security Settings
            </p>
            <p className="font-teachers font-normal text-white/70 text-[20px]">
              Manage your security settings and authentication.
            </p>
          </div>
        )
      
      case 'account':
        return (
          <div className="space-y-4">
            <p className="font-teachers font-normal text-white text-[32px]">
              Account Settings
            </p>
            <p className="font-teachers font-normal text-white/70 text-[20px]">
              Manage your account information and preferences.
            </p>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-black border border-white rounded w-[960px] h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white">
          <p className="font-teachers font-normal text-white text-[32px]">
            Settings
          </p>
          <button
            onClick={onClose}
            className="w-4 h-4 flex items-center justify-center hover:bg-white/15 rounded transition-colors"
          >
            <Image
              src="/icons/collapse.svg"
              alt="Close"
              width={16}
              height={16}
              className="w-4 h-4"
            />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1">
          {/* Sidebar */}
          <div className="w-1/3 border-r border-white p-2">
            <div className="space-y-2">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex gap-2.5 items-center px-1 py-1 rounded transition-colors ${
                    activeSection === section.id
                      ? 'bg-white text-black'
                      : 'text-white hover:bg-white/15'
                  }`}
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    <Image
                      src={section.icon}
                      alt={section.name}
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                  </div>
                  <p className={`font-teachers font-normal text-[32px] ${
                    activeSection === section.id ? 'text-black' : 'text-white'
                  }`}>
                    {section.name}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-2">
            {renderSettingsContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
