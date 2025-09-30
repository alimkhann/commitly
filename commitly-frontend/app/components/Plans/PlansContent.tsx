const PLANS = [
  {
    name: 'Free',
    price: '0',
    description: 'Plan description',
    ctaLabel: 'Current Plan',
    ctaStyle: 'muted',
    features: ['Plan feat 1', 'Plan feat 2', 'Plan feat 3', 'Plan feat 4']
  },
  {
    name: 'Pro',
    price: '15',
    description: 'Plan description',
    ctaLabel: 'Get Pro',
    ctaStyle: 'primary',
    features: ['All free feats included', 'Plan feat 1', 'Plan feat 2', 'Plan feat 3']
  },
  {
    name: 'Ultra',
    price: '100',
    description: 'Plan description',
    ctaLabel: 'Get Ultra',
    ctaStyle: 'primary',
    features: ['All pro feats included', 'Plan feat 1', 'Plan feat 2', 'Plan feat 3']
  }
] as const

interface PlansContentProps {
  onClose?: () => void
}

const CTA_STYLES: Record<'muted' | 'primary', string> = {
  muted: 'bg-[#AFAFAF] text-black',
  primary: 'bg-white text-black'
}

export default function PlansContent({ onClose }: PlansContentProps) {
  return (
    <div className="w-full">
      <div className="flex items-start justify-between">
        <div className="flex-1" aria-hidden="true" />
        {onClose && (
          <button
            aria-label="Close"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 3L13 13M13 3L3 13"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      <h1 className="font-teachers font-normal text-[40px] sm:text-[48px] text-center mt-8">
        Upgrade your plan
      </h1>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-[1344px] w-full mx-auto">
        {PLANS.map((plan) => (
          <section
            key={plan.name}
            className="border-2 border-white rounded p-8 h-full flex flex-col gap-6"
          >
            <h2 className="font-teachers font-bold text-[32px]">{plan.name}</h2>
            <div className="flex items-end gap-2">
              <span className="text-[#A6A6A6] text-[20px]">$</span>
              <span className="text-[64px] leading-none">{plan.price}</span>
              <div className="text-[#A6A6A6] text-[16px] leading-tight">
                <div>USD/</div>
                <div>month</div>
              </div>
            </div>
            <p className="font-teachers text-[24px]">{plan.description}</p>
            <button
              className={`w-full rounded py-2 text-[24px] ${CTA_STYLES[plan.ctaStyle]}`}
            >
              {plan.ctaLabel}
            </button>
            <ul className="mt-2 space-y-3 text-[20px]">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
