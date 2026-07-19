import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { SanitizedVerseHtml, UserAvatar } from '@/shared/ui'
import type { AvatarStackItem } from '@/shared/ui'

const ROW_TRANSITION = 'background-color 200ms, border-color 200ms'
const ROW_SELECTED_STYLE: CSSProperties = {
  background: 'var(--chip-bg)',
  borderLeft: '3px solid var(--lagoon)',
  transition: ROW_TRANSITION,
}
const ROW_UNSELECTED_STYLE: CSSProperties = {
  background: 'transparent',
  borderLeft: '3px solid transparent',
  transition: ROW_TRANSITION,
}

type Props = {
  collection: string
  book: string
  chapter: number
  verse: number
  textHtml?: string
  count: number
  mode: 'read' | 'select'
  selected: boolean
  onSelect: (verse: number) => void
  commenterMarker?: AvatarStackItem
  onMarkerClick?: (verse: number) => void
}

export function VerseRow({
  collection,
  book,
  chapter,
  verse,
  textHtml,
  count,
  mode,
  selected,
  onSelect,
  commenterMarker,
  onMarkerClick,
}: Props) {
  const containerStyle = selected ? ROW_SELECTED_STYLE : ROW_UNSELECTED_STYLE

  const rightBadge =
    count > 0 && !commenterMarker ? (
      <span
        className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
        style={{
          background: 'var(--chip-bg)',
          border: '1px solid var(--chip-line)',
          color: 'var(--palm)',
        }}
      >
        {count}件
      </span>
    ) : null

  const inner = (
    <div className="flex items-start gap-2 px-4 py-3">
      {mode === 'select' && (
        <div
          aria-hidden="true"
          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
          style={{
            border: `1.5px solid ${selected ? 'var(--lagoon)' : 'var(--line)'}`,
            background: selected ? 'var(--lagoon)' : 'transparent',
          }}
        >
          {selected && (
            <Check size={12} strokeWidth={3} color="#fff" aria-hidden="true" />
          )}
        </div>
      )}
      <div
        className="flex-1 min-w-0 flex items-start justify-between gap-2"
        style={{ color: 'var(--sea-ink)' }}
      >
        <div className="flex-1 min-w-0">
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--sea-ink-soft)' }}
          >
            {verse}
          </span>
          {textHtml && (
            <SanitizedVerseHtml
              html={textHtml}
              className="ml-2 text-sm"
              style={{ color: 'var(--sea-ink)' }}
            />
          )}
        </div>
        {rightBadge}
      </div>
    </div>
  )

  if (mode === 'select') {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`${verse}節を選択`}
        onClick={() => onSelect(verse)}
        className="w-full text-left"
        style={containerStyle}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className="relative" style={containerStyle}>
      <Link
        to="/scriptures/$collection/$book/$chapter"
        params={{ collection, book, chapter: String(chapter) }}
        search={{ verses: [verse] }}
        className="block"
      >
        {inner}
      </Link>
      {commenterMarker && (
        <button
          type="button"
          aria-label={`${commenterMarker.name} の ${verse}節 コメントを見る`}
          onClick={() => onMarkerClick?.(verse)}
          className="absolute z-10 rounded-full"
          style={{ top: 12, right: 32 }}
        >
          <UserAvatar
            name={commenterMarker.name}
            url={commenterMarker.avatarUrl}
            size="xs"
          />
        </button>
      )}
    </div>
  )
}
