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
  <div className="relative w-12 h-12">
    <Image
      src="/logos/logo_4x.png"
      alt="Commitly Logo"
      width={48}
      height={48}
      className="w-12 h-12"
    />
  </div>
)

const CollapseButton = ({ onClick, title }: { onClick: () => void; title: string }) => (
  <button
    onClick={onClick}
    className="relative w-8 h-8 hover:bg-white/15 rounded transition-colors"
    title={title}
  >
    <Image
      src="/icons/collapse.svg"
      alt="Collapse"
      width={32}
      height={32}
      className="w-8 h-8"
    />
  </button>
)

const NewRepoButton = ({ isCollapsed }: { isCollapsed: boolean }) => (
  <Link
    className={`${isCollapsed ? 'w-full h-12 flex items-center justify-start' : 'flex gap-2.5 items-center w-full h-12'} hover:bg-white/15 rounded transition-colors p-1`}
    title="New repo"
    href="/"
  >
    <div className="w-8 h-8 flex items-center justify-center shrink-0">

      <Image
        src="/icons/hammer_white.svg"
        alt="New repo"
        width={32}
        height={32}
        className="w-8 h-8 shrink-0"
        />
    </div>
    {!isCollapsed && (
      <p className="font-teachers font-normal text-white text-[32px] whitespace-nowrap">
        New repo
      </p>
    )}
  </Link>
)

const SearchRepoButton = ({ isCollapsed }: { isCollapsed: boolean }) => (
  <Link
    href="/search"
    className={`${isCollapsed ? 'w-full h-12 flex items-center justify-start' : 'flex gap-2.5 items-center w-full h-12'} hover:bg-white/15 rounded transition-colors p-1`}
    title="Search repo"
  >
    <div className="w-8 h-8 flex items-center justify-center shrink-0">
      <Image
        src="/icons/magnifyingglass_white.svg"
        alt="Search repo"
        width={32}
        height={32}
        className="w-8 h-8 shrink-0"
      />
    </div>
    {!isCollapsed && (
      <p className="font-teachers font-normal text-white text-[32px] whitespace-nowrap">
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
    <div className="flex flex-col gap-2.5 items-start w-full">
      {!isCollapsed && (
        <>
        <p className="font-teachers font-normal text-white text-[24px] whitespace-nowrap">
          Repos
        </p>

        <div className="flex flex-col gap-2.5 w-full">
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
              <p className={`font-teachers font-normal text-[24px] whitespace-nowrap ${
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
      <div className="flex gap-2.5 items-center p-1 w-full border-t border-white shadow-lg">
        <div className="relative w-8 h-8">
          <div className="w-8 h-8 bg-gray-400 rounded-full"></div>
        </div>
      </div>
    )
  }
  console.log(isAccountOpen, isCollapsed)
  return (
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
        <button className="flex gap-2.5 items-center w-full hover:bg-white/15 rounded transition-colors p-1">
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
        <button className="flex gap-2.5 items-center w-full hover:bg-white/15 rounded transition-colors p-1">
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
  )
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className={`bg-black h-full relative border-r border-white transition-[width] duration-300 ease-in-out ${isCollapsed ? 'w-[68px]' : 'w-[300px]'}`}>
      <div className="flex flex-col h-full items-start justify-between p-[10px]">
        {/* Top Section */}
        <div className="flex flex-col gap-16 items-start w-full">
          {/* Logo and collapse */}
          <div className={`flex items-center w-full ${isCollapsed ? 'justify-center' : 'justify-between pl-0 pr-3'}`}>
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
          <div className={`flex flex-col gap-2.5 w-full ${isCollapsed ? 'items-center' : 'items-start'}`}>
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
