'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="bg-black relative size-full min-h-screen">
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 h-full">
          {/* Search Menu */}
          <div className="flex flex-col gap-2 items-start pb-3 pt-0 px-0 relative rounded border border-white w-[768px]">
            {/* Top Section */}
            <div className="flex items-center justify-between pl-3 pr-4 py-1.5 relative w-full border-b border-white">
              <input
                type="text"
                placeholder="Search repos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="font-teachers font-normal text-white text-[26px] bg-transparent border-none outline-none placeholder:text-white flex-1"
              />
                <div className="w-3 h-3 flex items-center justify-center">
                  <span className="text-white text-base">×</span>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="flex flex-col gap-2 items-start justify-center px-3 py-0 relative w-full">
              {/* New Repo */}
              <div className="flex gap-2 items-center justify-center relative">
                <div className="w-6 h-5 flex items-center justify-center">
                  <Image
                    src="/icons/hammer_white.svg"
                    alt="New repo"
                    width={26}
                    height={24}
                    className="w-6 h-5"
                  />
                </div>
                <p className="font-teachers font-normal text-white text-[26px] whitespace-nowrap">
                  New repo
                </p>
              </div>

              {/* Today Section */}
              <div className="flex gap-2 items-center justify-center relative">
                <p className="font-teachers font-normal text-white text-[16px] whitespace-nowrap">
                  Today
                </p>
              </div>

              {/* Deepseek */}
              <div className="flex gap-2 items-center justify-center relative">
                <div className="w-6 h-5 flex items-center justify-center">
                  <Image
                    src="/icons/hammer_white.svg"
                    alt="Deepseek"
                    width={26}
                    height={24}
                    className="w-6 h-5"
                  />
                </div>
                <p className="font-teachers font-normal text-white text-[26px] whitespace-nowrap">
                  Deepseek
                </p>
              </div>

              {/* VSCode */}
              <div className="flex gap-2 items-center justify-center relative">
                <div className="w-6 h-5 flex items-center justify-center">
                  <Image
                    src="/icons/hammer_white.svg"
                    alt="VSCode"
                    width={26}
                    height={24}
                    className="w-6 h-5"
                  />
                </div>
                <p className="font-teachers font-normal text-white text-[26px] whitespace-nowrap">
                  VSCode
                </p>
              </div>

              {/* Yesterday Section */}
              <div className="flex gap-2 items-center justify-center relative">
                <p className="font-teachers font-normal text-white text-[16px] whitespace-nowrap">
                  Yesterday
                </p>
              </div>

              {/* Tencent */}
              <div className="flex gap-2 items-center justify-center relative">
                <div className="w-6 h-5 flex items-center justify-center">
                  <Image
                    src="/icons/hammer_white.svg"
                    alt="Tencent"
                    width={26}
                    height={24}
                    className="w-6 h-5"
                  />
                </div>
                <p className="font-teachers font-normal text-white text-[26px] whitespace-nowrap">
                  Tencent
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
