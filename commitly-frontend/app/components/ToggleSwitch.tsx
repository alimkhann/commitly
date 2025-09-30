'use client'

interface ToggleSwitchProps {
  isOn: boolean
  onToggle: () => void
}

export default function ToggleSwitch({ isOn, onToggle }: ToggleSwitchProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        className={`relative w-[28px] h-[16px] rounded-full transition-colors duration-200 ${
          isOn ? 'bg-white border border-black' : 'bg-black border border-white'
        }`}
        role="switch"
        aria-checked={isOn}
      >
        <div
          className={`absolute top-[1px] left-[1px] w-[11px] h-[11px] rounded-full transition-transform duration-200 ${
            isOn ? 'bg-black translate-x-[12px]' : 'bg-white translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
