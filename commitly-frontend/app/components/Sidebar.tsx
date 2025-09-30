'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

const USERNAME = 'zhanbo'

// Repo data mapping
const REPOS = [
  { name: 'Deepseek', id: 'deepseek' },
  { name: 'VSCode', id: 'vscode' },
  { name: 'Tencent', id: 'tencent' }
]

const Logo = ({ onClick }: { onClick?: () => void }) => (
  <div className="relative w-10 h-10">
    <Image
      src="/logos/logo_4x.png"
      alt="Commitly Logo"
      width={40}
      height={40}
      className="w-10 h-10"
    />
  </div>
)

const CollapseButton = ({ onClick, title }: { onClick: () => void; title: string }) => (
  <button
    onClick={onClick}
    className="relative w-6 h-6 hover:bg-white/15 rounded transition-colors"
    title={title}
  >
    <Image
      src="/icons/collapse.svg"
      alt="Collapse"
      width={26}
      height={26}
      className="w-6 h-6"
    />
  </button>
)

const NewRepoButton = ({ isCollapsed }: { isCollapsed: boolean }) => (
  <Link
    className={`${isCollapsed ? 'w-full h-10 flex items-center justify-start' : 'flex gap-2 items-center w-full h-10'} hover:bg-white/15 rounded transition-colors p-1`}
    title="New repo"
    href="/"
  >
    <div className="w-6 h-6 flex items-center justify-center shrink-0">

      <Image
        src="/icons/hammer_white.svg"
        alt="New repo"
        width={26}
        height={26}
        className="w-6 h-6 shrink-0"
        />
    </div>
    {!isCollapsed && (
      <p className="font-teachers font-normal text-white text-[26px] whitespace-nowrap">
        New repo
      </p>
    )}
  </Link>
)

const SearchRepoButton = ({ isCollapsed }: { isCollapsed: boolean }) => (
  <Link
    href="/search"
    className={`${isCollapsed ? 'w-full h-10 flex items-center justify-start' : 'flex gap-2 items-center w-full h-10'} hover:bg-white/15 rounded transition-colors p-1`}
    title="Search repo"
  >
    <div className="w-6 h-6 flex items-center justify-center shrink-0">
      <Image
        src="/icons/magnifyingglass_white.svg"
        alt="Search repo"
        width={26}
        height={26}
        className="w-6 h-6 shrink-0"
      />
    </div>
    {!isCollapsed && (
      <p className="font-teachers font-normal text-white text-[26px] whitespace-nowrap">
        Search repo
      </p>
    )}
  </Link>
)

const ReposSection = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const pathname = usePathname()

  // Determine if a repo is active based on current path
  const isRepoActive = (repoId: string) => {
    return pathname.startsWith(`/repo/${repoId}`)
  }

  return (
    <div className="flex flex-col gap-2 items-start w-full">
      {!isCollapsed && (
        <>
        <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
          Repos
        </p>

        <div className="flex flex-col gap-2 w-full">
          {REPOS.map((repo) => (
            <Link
              key={repo.id}
              href={`/repo/${repo.id}/timeline`}
              className={`flex items-center px-2 py-1 rounded w-full transition-colors ${
                isRepoActive(repo.id)
                  ? 'bg-white text-black'
                  : 'border border-white text-white hover:bg-white/15'
              }`}
            >
              <p className={`font-teachers font-normal text-[20px] whitespace-nowrap ${
                isRepoActive(repo.id) ? 'text-black' : 'text-white'
              }`}>
                {repo.name}
              </p>
            </Link>
          ))}
        </div>
        </>
      )}
    </div>
  )
}

const AccountSection = ({ isCollapsed }: { isCollapsed: boolean }) => {
  const [isAccountOpen, setIsAccountOpen] = useState(false)

  const toggleAccount = () => {
    setIsAccountOpen(!isAccountOpen)
  }

  if (isCollapsed) {
    return (
      <div className="flex gap-2 items-center p-1 w-full border-t border-white shadow-lg">
        <button
          onClick={toggleAccount}
          className="relative w-6 h-6 hover:bg-white/15 rounded transition-colors"
        >
          <div className="w-6 h-6 bg-gray-400 rounded-full"></div>
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-start w-full border-t border-white pt-3 shadow-lg">
      {/* Account Options Dropdown - Absolute positioned overlay */}
      <div className={`absolute bottom-full left-0 right-0 mb-2 flex flex-col gap-2 items-start px-3 py-2.5 rounded border border-white bg-black shadow-lg transition-all duration-300 ease-in-out z-10 ${
        isAccountOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}>
        {/* Profile with Email */}
        <div className="flex gap-2 items-center w-full">
          <div className="w-5 h-5 flex items-center justify-center">
            <Image
              src="/icons/profile.svg"
              alt="Profile"
              width={20}
              height={20}
              className="w-5 h-5"
            />
          </div>
          <p className="font-teachers font-normal text-white/70 text-[16px] whitespace-nowrap">
            zhanbo@gmail.com
          </p>
        </div>

        {/* Upgrade Plan */}
        <button className="flex gap-2 items-center w-full hover:bg-white/15 rounded transition-colors p-1">
          <div className="w-5 h-5 flex items-center justify-center">
            <Image
              src="/icons/upgrade_plan.svg"
              alt="Upgrade Plan"
              width={20}
              height={20}
              className="w-5 h-5"
            />
          </div>
          <p className="font-teachers font-normal text-white text-[16px] whitespace-nowrap">
            upgrade plan
          </p>
        </button>

        {/* Settings */}
        <button className="flex gap-2 items-center w-full hover:bg-white/15 rounded transition-colors p-1">
          <div className="w-5 h-5 flex items-center justify-center">
            <Image
              src="/icons/settings.svg"
              alt="Settings"
              width={20}
              height={20}
              className="w-5 h-5"
            />
          </div>
          <p className="font-teachers font-normal text-white text-[16px] whitespace-nowrap">
            settings
          </p>
        </button>

        {/* Help */}
        <button className="flex gap-2 items-center w-full hover:bg-white/15 rounded transition-colors p-1">
          <div className="w-5 h-5 flex items-center justify-center">
            <Image
              src="/icons/help.svg"
              alt="Help"
              width={20}
              height={20}
              className="w-5 h-5"
            />
          </div>
          <p className="font-teachers font-normal text-white text-[16px] whitespace-nowrap">
            help
          </p>
        </button>

        {/* Log Out */}
        <button className="flex gap-2 items-center w-full hover:bg-white/15 rounded transition-colors p-1">
          <div className="w-5 h-5 flex items-center justify-center">
            <Image
              src="/icons/logout.svg"
              alt="Log Out"
              width={20}
              height={20}
              className="w-5 h-5"
            />
          </div>
          <p className="font-teachers font-normal text-white text-[16px] whitespace-nowrap">
            log out
          </p>
        </button>
      </div>

      {/* Account Button */}
      <button
        onClick={toggleAccount}
        className="flex gap-2 items-center px-3 py-1.5 rounded border border-white w-full hover:bg-white/15 transition-colors"
      >
        <div className="relative w-6 h-6">
          <div className="w-6 h-6 bg-gray-400 rounded-full"></div>
        </div>
        <p className="font-teachers font-normal text-white text-[16px] whitespace-nowrap">
          {USERNAME}
        </p>
      </button>
    </div>
  )
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className={`bg-black h-full relative border-r border-white transition-[width] duration-300 ease-in-out ${isCollapsed ? 'w-[54px]' : 'w-[240px]'}`}>
      <div className="flex flex-col h-full items-start justify-between p-[8px]">
        {/* Top Section */}
        <div className="flex flex-col gap-12 items-start w-full">
          {/* Logo and collapse */}
          <div className={`flex items-center w-full ${isCollapsed ? 'justify-center' : 'justify-between pl-0 pr-2'}`}>
            {isCollapsed ? (
              <button onClick={toggleCollapse}>
                <div className="flex items-center justify-start w-full">
                  <Logo />
                </div>
              </button>
            ) : (
              <>
                <Link href="/">
                  <Logo />
                </Link>
                <CollapseButton onClick={toggleCollapse} title="Collapse sidebar" />
              </>
            )}
          </div>

          {/* Sidebar Chat Options */}
          <div className={`flex flex-col gap-2 w-full ${isCollapsed ? 'items-center' : 'items-start'}`}>
            <NewRepoButton isCollapsed={isCollapsed} />
            <SearchRepoButton isCollapsed={isCollapsed} />
          </div>

          {/* Repos Section */}
          <ReposSection isCollapsed={isCollapsed} />
        </div>

        {/* Account Section */}
        <AccountSection isCollapsed={isCollapsed} />
      </div>
    </div>
  )
}
