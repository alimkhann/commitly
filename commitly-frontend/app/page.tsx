'use client'

import { useState } from 'react'
import Image from 'next/image'
import Sidebar from './components/Sidebar'

export default function Home() {
  const [repoLink, setRepoLink] = useState('')

  return (
    <div className="bg-black relative size-full min-h-screen">
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 h-full">
          {/* Name Logo */}
          <div className="flex gap-1.5 items-center justify-center">
            <div className="relative w-20 h-20">
              <Image
                src="/logos/logo_4x.png"
                alt="Commitly Logo"
                width={80}
                height={80}
                className="w-20 h-20"
              />
            </div>
            <p className="font-teachers font-bold text-white text-[52px] whitespace-nowrap">
              commitly
            </p>
          </div>

          {/* Textfield */}
          <div className="bg-white flex items-center justify-between px-3 py-1.5 rounded w-[456px] border border-white">
            <input
              type="text"
              placeholder="paste a github repo link"
              value={repoLink}
              onChange={(e) => setRepoLink(e.target.value)}
              className="font-teachers font-normal text-black text-[26px] flex-1 bg-transparent border-none outline-none placeholder:text-black"
            />
            <div className="w-6 h-5 flex items-center justify-center">
              <Image
                src="/icons/hammer_black.svg"
                alt="Submit"
                width={26}
                height={24}
                className="w-6 h-5"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
