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
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5 h-full">
          {/* Search Menu */}
          <div className="flex flex-col gap-2.5 items-start pb-4 pt-0 px-0 relative rounded border border-white w-[960px]">
            {/* Top Section */}
            <div className="flex items-center justify-between pl-4 pr-5 py-2 relative w-full border-b border-white">
              <input
                type="text"
                placeholder="Search repos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="font-teachers font-normal text-white text-[32px] bg-transparent border-none outline-none placeholder:text-white flex-1"
              />
                <div className="w-4 h-4 flex items-center justify-center">
                  <span className="text-white text-lg">×</span>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="flex flex-col gap-2.5 items-start justify-center px-4 py-0 relative w-full">
              {/* New Repo */}
              <div className="flex gap-2.5 items-center justify-center relative">
                <div className="w-8 h-7 flex items-center justify-center">
                  <Image
                    src="/icons/hammer_white.svg"
                    alt="New repo"
                    width={32}
                    height={30}
                    className="w-8 h-7"
                  />
                </div>
                <p className="font-teachers font-normal text-white text-[32px] whitespace-nowrap">
                  New repo
                </p>
              </div>

              {/* Today Section */}
              <div className="flex gap-2.5 items-center justify-center relative">
                <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
                  Today
                </p>
              </div>

              {/* Deepseek */}
              <div className="flex gap-2.5 items-center justify-center relative">
                <div className="w-8 h-7 flex items-center justify-center">
                  <Image
                    src="/icons/hammer_white.svg"
                    alt="Deepseek"
                    width={32}
                    height={30}
                    className="w-8 h-7"
                  />
                </div>
                <p className="font-teachers font-normal text-white text-[32px] whitespace-nowrap">
                  Deepseek
                </p>
              </div>

              {/* VSCode */}
              <div className="flex gap-2.5 items-center justify-center relative">
                <div className="w-8 h-7 flex items-center justify-center">
                  <Image
                    src="/icons/hammer_white.svg"
                    alt="VSCode"
                    width={32}
                    height={30}
                    className="w-8 h-7"
                  />
                </div>
                <p className="font-teachers font-normal text-white text-[32px] whitespace-nowrap">
                  VSCode
                </p>
              </div>

              {/* Yesterday Section */}
              <div className="flex gap-2.5 items-center justify-center relative">
                <p className="font-teachers font-normal text-white text-[20px] whitespace-nowrap">
                  Yesterday
                </p>
              </div>

              {/* Tencent */}
              <div className="flex gap-2.5 items-center justify-center relative">
                <div className="w-8 h-7 flex items-center justify-center">
                  <Image
                    src="/icons/hammer_white.svg"
                    alt="Tencent"
                    width={32}
                    height={30}
                    className="w-8 h-7"
                  />
                </div>
                <p className="font-teachers font-normal text-white text-[32px] whitespace-nowrap">
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
