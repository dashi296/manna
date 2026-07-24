import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { SanitizedVerseHtml, UserAvatar } from '@/shared/ui'
import type { AvatarStackItem } from '@/shared/ui'
import { cn } from '@/shared/lib/utils'

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
  textHtmlSecondary?: string
  secondaryLang?: string
  mode: 'read' | 'select'
  selected: boolean
  onSelect: (verse: number) => void
  commenterMarker?: AvatarStackItem
  onMarkerClick?: (verse: number) => void
  showNumber?: boolean
}

export function VerseRow({
  collection,
  book,
  chapter,
  verse,
  textHtml,
  textHtmlSecondary,
  secondaryLang,
  mode,
  selected,
  onSelect,
  commenterMarker,
  onMarkerClick,
  showNumber = true,
}: Props) {
  const containerStyle = selected ? ROW_SELECTED_STYLE : ROW_UNSELECTED_STYLE

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
          {showNumber && (
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--sea-ink-soft)' }}
            >
              {verse}
            </span>
          )}
          {textHtml && (
            <div className={textHtmlSecondary ? 'flex flex-col gap-1 lg:flex-row lg:gap-4' : undefined}>
              <SanitizedVerseHtml
                html={textHtml}
                className={cn(showNumber ? 'ml-2 text-sm' : 'text-sm', textHtmlSecondary && 'lg:flex-1')}
                style={{ color: 'var(--sea-ink)' }}
              />
              {textHtmlSecondary && (
                <SanitizedVerseHtml
                  html={textHtmlSecondary}
                  className={cn('text-sm lg:flex-1', showNumber && 'ml-2 lg:ml-0')}
                  style={{ color: 'var(--sea-ink-soft)' }}
                  lang={secondaryLang}
                />
              )}
            </div>
          )}
        </div>
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
        search={(prev) => ({ ...prev, verses: [verse] })}
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
          style={{ top: 12, right: -4 }}
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
