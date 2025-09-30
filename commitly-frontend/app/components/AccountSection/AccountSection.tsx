'use client'

import Image from 'next/image'
import { useState } from 'react'
import Settings from './Settings'
import ReportBug from '../ReportBug'
import { useRouter } from 'next/navigation'

const USERNAME = 'zhanbo'

interface AccountSectionProps {
  isCollapsed: boolean
}

export default function AccountSection({ isCollapsed }: AccountSectionProps) {
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isUpgradePlanOpen, setIsUpgradePlanOpen] = useState(false)
  const [isHelpHovered, setIsHelpHovered] = useState(false)
  const [isHelpSubmenuHovered, setIsHelpSubmenuHovered] = useState(false)
  const [isReportBugOpen, setIsReportBugOpen] = useState(false)
  const router = useRouter()

  const toggleAccount = () => {
    setIsAccountOpen(!isAccountOpen)
  }

  const openSettings = () => {
    setIsSettingsOpen(true)
    setIsAccountOpen(false)
  }

  const openUpgradePlan = () => {
    setIsAccountOpen(false)
    router.push('/plans')
  }

  // Show submenu when either help button or submenu is hovered
  const showHelpSubmenu = isHelpHovered || isHelpSubmenuHovered

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

          {/* Help with Submenu */}
          <div className="relative w-full">
            <button
              className="flex gap-2.5 items-center w-full hover:bg-white/15 rounded transition-colors p-1"
              onMouseEnter={() => setIsHelpHovered(true)}
              onMouseLeave={() => setIsHelpHovered(false)}
            >
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
              {showHelpSubmenu && (
                <div className="ml-auto flex items-center">
                  <Image
                    src="/icons/chevron_right_white.svg"
                    alt="arrow right"
                    width={16}
                    height={16}
                    className="w-4 h-4"
                  />
                </div>
              )}
            </button>

            {/* Help Submenu */}
            {showHelpSubmenu && (
              <div
                className="absolute left-full ml-0 flex flex-col gap-2.5 items-start px-4 py-3 rounded border border-white bg-black shadow-lg min-w-[260px] -top-[164px]"
                onMouseEnter={() => setIsHelpSubmenuHovered(true)}
                onMouseLeave={() => setIsHelpSubmenuHovered(false)}
              >
                {/* Help Center */}
                <button onClick={() => { setIsAccountOpen(false); router.push('/help-center') }} className="flex gap-2.5 items-center w-full hover:bg-white/15 rounded transition-colors p-1 group">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <Image
                      src="/icons/help.svg"
                      alt="Help Center"
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                  </div>
                  <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
                    help center
                  </p>
                  <div className="ml-auto flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Image
                      src="/icons/diagonal_arrow_white.svg"
                      alt="external link"
                      width={16}
                      height={16}
                      className="w-4 h-4"
                    />
                  </div>
                </button>

                {/* Release Notes */}
                <button onClick={() => { setIsAccountOpen(false); router.push('/release-notes') }} className="flex gap-2.5 items-center w-full hover:bg-white/15 rounded transition-colors p-1 group">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <Image
                      src="/icons/pencil_line_white.svg"
                      alt="Release Notes"
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                  </div>
                  <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
                    release notes
                  </p>
                  <div className="ml-auto flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Image
                      src="/icons/diagonal_arrow_white.svg"
                      alt="external link"
                      width={16}
                      height={16}
                      className="w-4 h-4"
                    />
                  </div>
                </button>

                {/* Terms & Policies */}
                <button onClick={() => { setIsAccountOpen(false); router.push('/policies') }} className="flex gap-2.5 items-center w-full hover:bg-white/15 rounded transition-colors p-1 group">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <Image
                      src="/icons/note_text_white.svg"
                      alt="Terms & Policies"
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                  </div>
                  <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
                    terms & policies
                  </p>
                  <div className="ml-auto flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Image
                      src="/icons/diagonal_arrow_white.svg"
                      alt="external link"
                      width={16}
                      height={16}
                      className="w-4 h-4"
                    />
                  </div>
                </button>

                {/* Report Bug - Same level as help */}
                <button onClick={() => { setIsAccountOpen(false); setIsReportBugOpen(true) }} className="flex gap-2.5 items-center w-full hover:bg-white/15 rounded transition-colors p-1">
                  <div className="w-6 h-6 flex items-center justify-center">
                    <Image
                      src="/icons/flag_white.svg"
                      alt="Report Bug"
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                  </div>
                  <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
                    report bug
                  </p>
                </button>
              </div>
            )}
          </div>

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
            ? 'flex items-center justify-center w-10 h-10 rounded-full mx-auto'
            : 'flex items-center gap-2.5 px-4 py-2 rounded w-full'
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

      {/* Report Bug Modal */}
      <ReportBug isOpen={isReportBugOpen} onClose={() => setIsReportBugOpen(false)} />
    </>
  )
}
