import type { MouseEvent } from 'react'

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
      {checked && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="white"
          className="w-3 h-3"
        >
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  )
}
