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

  return (
    <>
      {isAccountOpen && (
        <div
          className="fixed inset-0 z-[5] bg-transparent"
          onClick={(event) => {
            event.stopPropagation()
            setIsAccountOpen(false)
          }}
          aria-hidden="true"
        />
      )}
      <div
        className={`relative z-[10] flex flex-col w-full shadow-lg ${isCollapsed ? 'items-start pt-2 pl-0' : 'items-start pt-4'
          }`}
      >
        {/* Account Options Dropdown - Absolute positioned overlay */}
        <div
          className={`absolute bottom-full mb-2 flex flex-col gap-2.5 items-start px-4 py-3 rounded border border-white bg-black shadow-lg transition-all duration-300 ease-in-out ${isCollapsed ? 'left-0 min-w-[240px]' : 'left-0 right-0'
            } ${isAccountOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}
        >
          {/* Profile with Email */}
          <div className="flex gap-2.5 items-center w-full">
            <div className="w-6 h-6 flex items-center justify-center">
              <Image
                src="/icons/profile_white.svg"
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
                src="/icons/settings_white.svg"
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
          className={`${isCollapsed
            ? 'flex items-center justify-start w-full py-1.5 rounded pl-1.5'
            : 'flex items-center gap-2.5 px-1.5 py-1.5 rounded w-full'
            } ${isAccountOpen ? 'border border-white' : 'border border-transparent'} hover:bg-white/15 transition-colors`}
        >
          <div className="relative w-8 h-8">
            <div className="w-8 h-8 bg-gray-400 rounded-full"></div>
          </div>
          {!isCollapsed && (
            <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
              {USERNAME}
            </p>
          )}
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
