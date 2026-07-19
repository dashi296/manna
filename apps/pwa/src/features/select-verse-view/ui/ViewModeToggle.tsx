import type { VerseViewMode } from '@/features/select-verse-view/model/viewMode'

type Props = {
  value: VerseViewMode
  onChange: (next: VerseViewMode) => void
}

const OPTIONS: { value: VerseViewMode; label: string }[] = [
  { value: 'count', label: '件数' },
  { value: 'who', label: '誰が' },
]

export function ViewModeToggle({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="節一覧の表示モード"
      className="inline-flex items-center rounded-full overflow-hidden"
      style={{ border: '1px solid var(--line)' }}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (!active) onChange(opt.value)
            }}
            className="px-3 py-1 text-xs font-medium transition-colors"
            style={{
              background: active ? 'var(--lagoon)' : 'transparent',
              color: active ? '#fff' : 'var(--sea-ink-soft)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
