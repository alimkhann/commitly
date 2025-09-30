'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function Home() {
  const [repoLink, setRepoLink] = useState('')

  return (
    <div className="flex flex-col items-center justify-center gap-2.5 h-full">
      {/* Name Logo */}
      <div className="flex gap-2 items-center justify-center">
        <div className="relative w-24 h-24">
          <Image
            src="/logos/logo_4x.png"
            alt="Commitly Logo"
            width={96}
            height={96}
            className="w-24 h-24"
          />
        </div>
        <p className="font-teachers font-bold text-white text-[64px] whitespace-nowrap">
          commitly
        </p>
      </div>

      {/* Textfield */}
      <div className="bg-white flex items-center justify-between px-4 py-2 rounded w-[570px] border border-white">
        <input
          type="text"
          placeholder="paste a github repo link"
          value={repoLink}
          onChange={(e) => setRepoLink(e.target.value)}
          className="font-teachers font-normal text-black text-[32px] flex-1 bg-transparent border-none outline-none placeholder:text-black"
        />
        <div className="w-8 h-7 flex items-center justify-center">
          <Image
            src="/icons/hammer_black.svg"
            alt="Submit"
            width={32}
            height={30}
            className="w-8 h-7"
          />
        </div>
      </div>
    </div>
  )
}