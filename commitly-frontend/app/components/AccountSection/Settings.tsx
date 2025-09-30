'use client'

import Image from 'next/image'
import { useState } from 'react'
import ToggleSwitch from '../ToggleSwitch'

interface SettingsProps {
  onClose: () => void
}

type SettingsSection = 'general' | 'notifications' | 'security' | 'account'

export default function Settings({ onClose }: SettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [responsesEnabled, setResponsesEnabled] = useState(false)
  const [mfaEnabled, setMfaEnabled] = useState(false)

  const settingsSections = [
    { id: 'general' as const, name: 'General', icon: '/icons/settings_white.svg' },
    { id: 'notifications' as const, name: 'Notifications', icon: '/icons/notifications_white.svg' },
    { id: 'security' as const, name: 'Security', icon: '/icons/keys_white.svg' },
    { id: 'account' as const, name: 'Account', icon: '/icons/profile_white.svg' }
  ]

  const renderSettingsContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-4">
            {/* Theme Setting */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-responsive-4xl">
                Theme
              </p>
              <div className="flex gap-2 items-center justify-center">
                <p className="font-teachers font-normal text-white text-responsive-3xl">
                  System
                </p>
                <div className="w-4 h-3 flex items-center justify-center">
                  <Image
                    src="/icons/cross_white.svg"
                    alt="Dropdown"
                    width={16}
                    height={10}
                    className="w-4 h-3"
                  />
                </div>
              </div>
            </div>

            {/* Language Setting */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-responsive-4xl">
                Language
              </p>
              <div className="flex gap-2 items-center justify-center">
                <p className="font-teachers font-normal text-white text-responsive-3xl">
                  Auto-detect
                </p>
                <div className="w-4 h-3 flex items-center justify-center">
                  <Image
                    src="/icons/cross_white.svg"
                    alt="Dropdown"
                    width={16}
                    height={10}
                    className="w-4 h-3"
                  />
                </div>
              </div>
            </div>
          </div>
        )
      
      case 'notifications':
        return (
          <div className="space-y-4">
            {/* Responses Setting */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-responsive-4xl">
                Responses
              </p>
              <ToggleSwitch
                isOn={responsesEnabled}
                onToggle={() => setResponsesEnabled(!responsesEnabled)}
                // label={responsesEnabled ? 'Push' : undefined}
              />
            </div>
            
            {/* Description */}
            <p className="font-teachers font-normal text-[#a6a6a6] text-responsive-3xl">
              Get notified when commitly responds to requests that take time, like timeline creation.
            </p>
          </div>
        )
      
      case 'security':
        return (
          <div className="space-y-4">
            {/* Multi-factor authentication */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-responsive-4xl">
                Multi-factor authentication
              </p>
              <ToggleSwitch
                isOn={mfaEnabled}
                onToggle={() => setMfaEnabled(!mfaEnabled)}
              />
            </div>
            
            {/* MFA Description */}
            <p className="font-teachers font-normal text-[#a6a6a6] text-responsive-3xl">
              Require an extra security challenge when logging in. If you are unable to pass this challenge, you will have the option to recover your account via email.
            </p>

            {/* Log out of this device */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-responsive-4xl">
                Log out of this device
              </p>
              <button className="px-3 py-1.5 border border-white text-white hover:bg-white/15 rounded transition-colors font-teachers text-responsive-base">
                Log out
              </button>
            </div>

            {/* Log out of all devices */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-responsive-4xl">
                Log out of all devices
              </p>
              <button className="px-3 py-1.5 border border-[#ba2623] text-[#ba2623] hover:bg-[#ba2623]/15 rounded transition-colors font-teachers text-responsive-base">
                Log out all
              </button>
            </div>
          </div>
        )
      
      case 'account':
        return (
          <div className="space-y-4">
            {/* Free Plan */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-responsive-4xl">
                Free Plan
              </p>
              <button className="flex gap-2 items-center px-2.5 py-1.5 border border-white text-white hover:bg-white/15 rounded transition-colors font-teachers text-responsive-3xl">
                Manage
                <Image
                  src="/icons/cross_white.svg"
                  alt="Dropdown"
                  width={16}
                  height={10}
                  className="w-4 h-3"
                />
              </button>
            </div>

            {/* Plan Features */}
            <p className="font-teachers font-normal text-white text-responsive-3xl">
              Your plan includes:
            </p>
            <div className="space-y-1.5">
              <p className="font-teachers font-normal text-white text-responsive-3xl">
                feat
              </p>
              <p className="font-teachers font-normal text-white text-responsive-3xl">
                feat
              </p>
              <p className="font-teachers font-normal text-white text-responsive-3xl">
                feat
              </p>
            </div>

            {/* Payment */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-responsive-4xl">
                Payment
              </p>
              <button className="px-2.5 py-1.5 border border-white text-white hover:bg-white/15 rounded transition-colors font-teachers text-responsive-3xl">
                Manage
              </button>
            </div>

            {/* Delete Account */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-responsive-4xl">
                Delete Account
              </p>
              <button className="px-2.5 py-1.5 border border-[#ba2623] text-[#ba2623] hover:bg-[#ba2623]/15 rounded transition-colors font-teachers text-responsive-3xl">
                Delete
              </button>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between">
              <p className="font-teachers font-normal text-white text-responsive-4xl">
                Email
              </p>
              <p className="font-teachers font-normal text-white text-responsive-base">
                zhanbo@gmail.com
              </p>
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-black border border-white rounded w-responsive-dialog h-responsive-dialog flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white">
          <p className="font-teachers font-normal text-white text-responsive-4xl">
            Settings
          </p>
          <button
            onClick={onClose}
            className="w-3 h-3 flex items-center justify-center hover:bg-white/15 rounded transition-colors"
          >
            <Image
              src="/icons/cross_white.svg"
              alt="Close"
              width={12}
              height={12}
              className="w-3 h-3"
            />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1">
          {/* Sidebar */}
          <div className="w-1/3 border-r border-white p-2">
            <div className="space-y-0">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex gap-2.5 items-center px-1 py-0 rounded transition-colors ${
                    activeSection === section.id
                      ? 'bg-white text-black'
                      : 'text-white hover:bg-white/15'
                  }`}
                >
                  <div className="w-7 h-7 flex items-center justify-center">
                    <Image
                      src={activeSection === section.id ? section.icon.replace('white', 'black') : section.icon}
                      alt={section.name}
                      width={30}
                      height={30}
                      className="w-7 h-7"
                    />
                  </div>
                  <p className={`font-teachers font-normal text-responsive-4xl ${
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
