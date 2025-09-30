'use client'

import Image from 'next/image'
import { useState } from 'react'
import Settings from './Settings'
import UpgradePlan from './UpgradePlan'

const USERNAME = 'zhanbo'

interface AccountSectionProps {
  isCollapsed: boolean
}

export default function AccountSection({ isCollapsed }: AccountSectionProps) {
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isUpgradePlanOpen, setIsUpgradePlanOpen] = useState(false)

  const toggleAccount = () => {
    setIsAccountOpen(!isAccountOpen)
  }

  const openSettings = () => {
    setIsSettingsOpen(true)
    setIsAccountOpen(false)
  }

  const openUpgradePlan = () => {
    setIsUpgradePlanOpen(true)
    setIsAccountOpen(false)
  }

  if (isCollapsed) {
    return (
      <div className="flex gap-2.5 items-center p-1 w-full border-t border-white shadow-lg">
        <div className="relative w-8 h-8">
          <div className="w-8 h-8 bg-gray-400 rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="relative flex flex-col items-start w-full border-t border-white pt-4 shadow-lg">
        {/* Account Options Dropdown - Absolute positioned overlay */}
        <div className={`absolute bottom-full left-0 right-0 mb-2 flex flex-col gap-2.5 items-start px-4 py-3 rounded border border-white bg-black shadow-lg z-10 ${
          isAccountOpen && !isCollapsed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}>
          {/* Profile with Email */}
          <div className="flex gap-2.5 items-center w-full">
            <div className="w-6 h-6 flex items-center justify-center">
              <Image
                src="/icons/profile.svg"
                alt="Profile"
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </div>
            <p className="font-teachers font-normal text-white/70 text-[20px] whitespace-nowrap">
              zhanbo@gmail.com
            </p>
          </div>

          {/* Upgrade Plan */}
          <button 
            onClick={openUpgradePlan}
            className="flex gap-2.5 items-center w-full hover:bg-white/15 rounded transition-colors p-1"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <Image
                src="/icons/upgrade_plan.svg"
                alt="Upgrade Plan"
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </div>
            <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
              upgrade plan
            </p>
          </button>

          {/* Settings */}
          <button 
            onClick={openSettings}
            className="flex gap-2.5 items-center w-full hover:bg-white/15 rounded transition-colors p-1"
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <Image
                src="/icons/settings.svg"
                alt="Settings"
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </div>
            <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
              settings
            </p>
          </button>

          {/* Help */}
          <button className="flex gap-2.5 items-center w-full hover:bg-white/15 rounded transition-colors p-1">
            <div className="w-6 h-6 flex items-center justify-center">
              <Image
                src="/icons/help.svg"
                alt="Help"
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </div>
            <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
              help
            </p>
          </button>

          {/* Log Out */}
          <button className="flex gap-2.5 items-center w-full hover:bg-white/15 rounded transition-colors p-1">
            <div className="w-6 h-6 flex items-center justify-center">
              <Image
                src="/icons/logout.svg"
                alt="Log Out"
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </div>
            <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
              log out
            </p>
          </button>
        </div>

        {/* Account Button */}
        <button
          onClick={toggleAccount}
          className="flex gap-2.5 items-center px-4 py-2 rounded border border-white w-full hover:bg-white/15 transition-colors"
        >
          <div className="relative w-8 h-8">
            <div className="w-8 h-8 bg-gray-400 rounded-full"></div>
          </div>
          <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
            {USERNAME}
          </p>
        </button>
      </div>

      {/* Settings Dialog */}
      {isSettingsOpen && (
        <Settings onClose={() => setIsSettingsOpen(false)} />
      )}

      {/* Upgrade Plan Dialog */}
      {isUpgradePlanOpen && (
        <UpgradePlan onClose={() => setIsUpgradePlanOpen(false)} />
      )}
    </>
  )
}
