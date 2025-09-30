'use client'

import Image from 'next/image'

interface UpgradePlanProps {
  onClose: () => void
}

export default function UpgradePlan({ onClose }: UpgradePlanProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-black border border-white rounded p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-teachers font-normal text-white text-[32px]">
            Upgrade Plan
          </h2>
          <button
            onClick={onClose}
            className="w-4 h-4 flex items-center justify-center hover:bg-white/15 rounded transition-colors"
          >
            <Image
              src="/icons/collapse.svg"
              alt="Close"
              width={16}
              height={16}
              className="w-4 h-4"
            />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <p className="font-teachers font-normal text-white/70 text-[20px]">
            Upgrade to unlock premium features and get unlimited access to all repositories.
          </p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <p className="font-teachers font-normal text-white text-[20px]">
                Unlimited repositories
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <p className="font-teachers font-normal text-white text-[20px]">
                Advanced analytics
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <p className="font-teachers font-normal text-white text-[20px]">
                Priority support
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-white text-white hover:bg-white/15 rounded transition-colors font-teachers text-[20px]"
            >
              Cancel
            </button>
            <button className="flex-1 px-4 py-2 bg-white text-black hover:bg-white/90 rounded transition-colors font-teachers text-[20px]">
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
