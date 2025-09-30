'use client'

import { useRouter } from 'next/navigation'
import PlansContent from '../components/Plans/PlansContent'

export default function PlansPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen w-full bg-black text-white px-6 py-8">
      <div className="max-w-[1856px] mx-auto">
        <PlansContent onClose={() => router.back()} />
      </div>
    </main>
  )
}
