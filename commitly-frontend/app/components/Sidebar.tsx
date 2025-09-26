'use client'

import Image from 'next/image'
import { useState } from 'react'

// Username variable for future customization
const USERNAME = 'zhanbo'

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  if (isCollapsed) {
    return (
      <div className="bg-black h-full relative w-[68px] border-r border-white transition-[width] duration-300 ease-in-out">
        <div className="flex flex-col h-full items-start justify-between p-[10px]">
          {/* Top Section */}
          <div className="flex flex-col gap-16 items-start w-full">
            {/* Logo only */}
            <button onClick={toggleCollapse}>
              <div className="flex items-center justify-center w-full">
                <div className="relative w-12 h-12">
                  <Image
                    src="/logos/logo_4x.png"
                    alt="Commitly Logo"
                    width={48}
                    height={48}
                    className="w-12 h-12"
                  />
                </div>
              </div>
            </button>

            {/* Sidebar actions - icons only */}
            <div className="flex flex-col gap-2.5 items-center w-full">
              <button 
                className="w-full h-12 flex items-center justify-start hover:bg-gray-800 rounded transition-colors p-1"
                title="New repo"
              >
                <Image
                  src="/icons/hammer_white.svg"
                  alt="New repo"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
              </button>
              <button 
                className="w-full h-12 flex items-center justify-start hover:bg-gray-800 rounded transition-colors p-1"
                title="Search repo"
              >
                <Image
                  src="/icons/magnifyingglass_white.svg"
                  alt="Search repo"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
              </button>
            </div>
          </div>

          {/* Account Section - avatar only */}
          <div className="flex items-center justify-start p-1 w-full border-t border-white">
            <div className="relative w-8 h-8">
              <div className="w-8 h-8 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black h-full relative w-[300px] border-r border-white transition-[width] duration-300 ease-in-out">
      <div className="flex flex-col h-full items-start justify-between p-[10px]">
        {/* Top Section */}
        <div className="flex flex-col gap-16 items-start w-full">
          {/* Logo and collapse */}
          <div className="flex items-center justify-between w-full pl-0 pr-3">
            <div className="relative w-12 h-12">
              <Image
                src="/logos/logo_4x.png"
                alt="Commitly Logo"
                width={48}
                height={48}
                className="w-12 h-12"
              />
            </div>
            <button 
              onClick={toggleCollapse}
              className="relative w-8 h-8 hover:bg-gray-800 rounded transition-colors"
              title="Collapse sidebar"
            >
              <Image
                  src="/icons/collapse.svg"
                  alt="New repo"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
            </button>
          </div>

          {/* Sidebar Chat Options */}
          <div className="flex flex-col gap-2.5 items-start w-full">
            <button className="flex gap-2.5 items-center w-full h-12 hover:bg-gray-800 rounded transition-colors p-1">
              <div className="w-8 h-8 flex items-center justify-center">
                <Image
                  src="/icons/hammer_white.svg"
                  alt="New repo"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
              </div>
              <p className="font-teachers font-normal text-white text-[32px] whitespace-nowrap">
                New repo
              </p>
            </button>
            <button className="flex gap-2.5 items-center w-full h-12 hover:bg-gray-800 rounded transition-colors p-1">
              <div className="w-8 h-8 flex items-center justify-center">
                <Image
                  src="/icons/magnifyingglass_white.svg"
                  alt="Search repo"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
              </div>
              <p className="font-teachers font-normal text-white text-[32px] whitespace-nowrap">
                Search repo
              </p>
            </button>
          </div>

          {/* Repos Section */}
          <div className="flex flex-col gap-2.5 items-start w-full">
            <p className="font-teachers font-normal text-white text-[24px] whitespace-nowrap">
              Repos
            </p>
            <div className="flex flex-col gap-2.5 w-full">
              <button className="flex items-center px-2 py-1 rounded border border-white w-full hover:bg-gray-800 transition-colors">
                <p className="font-teachers font-normal text-white text-[24px] whitespace-nowrap">
                  Deepseek
                </p>
              </button>
              <button className="flex items-center px-2 py-1 rounded border border-white w-full hover:bg-gray-800 transition-colors">
                <p className="font-teachers font-normal text-white text-[24px] whitespace-nowrap">
                  VSCode
                </p>
              </button>
              <button className="flex items-center px-2 py-1 rounded border border-white w-full hover:bg-gray-800 transition-colors">
                <p className="font-teachers font-normal text-white text-[24px] whitespace-nowrap">
                  Niggachain.ai
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="flex gap-2.5 items-center p-1 w-full border-t border-white">
          <div className="relative w-8 h-8">
            <div className="w-8 h-8 bg-gray-400 rounded-full"></div>
          </div>
          <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
            {USERNAME}
          </p>
        </div>
      </div>
    </div>
  )
}