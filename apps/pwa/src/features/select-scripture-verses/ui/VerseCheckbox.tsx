import type { MouseEvent } from 'react'
import { Check } from 'lucide-react'

type Props = {
  verse: number
  checked: boolean
  onToggle: (verse: number) => void
}

export function VerseCheckbox({ verse, checked, onToggle }: Props) {
  const handleClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggle(verse)
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`${verse}節を選択`}
      onClick={handleClick}
      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
      style={{
        border: `1.5px solid ${checked ? 'var(--lagoon)' : 'var(--line)'}`,
        background: checked ? 'var(--lagoon)' : 'transparent',
      }}
    >
      {checked && <Check size={12} strokeWidth={3} color="#fff" aria-hidden="true" />}
    </button>
  )
}
