'use client'

interface ToggleSwitchProps {
  isOn: boolean
  onToggle: () => void
}

export default function ToggleSwitch({ isOn, onToggle }: ToggleSwitchProps) {
  return (
    <div className="flex items-center gap-[10px]">
      <button
        onClick={onToggle}
        className={`relative w-[36px] h-[20px] rounded-full transition-colors duration-200 ${
          isOn ? 'bg-white border border-black' : 'bg-black border border-white'
        }`}
        role="switch"
        aria-checked={isOn}
      >
        <div
          className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full transition-transform duration-200 ${
            isOn ? 'bg-black translate-x-[16px]' : 'bg-white translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
