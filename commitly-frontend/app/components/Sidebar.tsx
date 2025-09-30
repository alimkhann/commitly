'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import AccountSection from './AccountSection/AccountSection'

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

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div className={`bg-black h-full relative border-r border-white transition-[width] duration-300 ease-in-out ${isCollapsed ? 'w-[68px]' : 'w-[300px]'}`}>
      <div className="flex flex-col h-full items-start justify-between p-[10px]">
        {/* Top Section */}
        <div className="flex flex-col flex-1 gap-16 items-start w-full overflow-hidden">
          {/* Logo and collapse */}
          <div className={`flex items-center w-full ${isCollapsed ? 'justify-start pl-0 pr-0' : 'justify-between pl-0 pr-3'}`}>
            {isCollapsed ? (
              <button onClick={toggleCollapse} className="flex items-center justify-start w-full">
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
          <div className={`w-full flex-1 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto pr-1'}`}>
            <ReposSection isCollapsed={isCollapsed} />
          </div>
        </div>

        {/* Account Section */}
        <AccountSection isCollapsed={isCollapsed} />
      </div>
    </div>
  )
}
