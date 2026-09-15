import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { SanitizedVerseHtml } from '@/shared/ui'

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
// ガターの印にホバーしたとき、その投稿が対象にしている節を示す
const ROW_HIGHLIGHTED_STYLE: CSSProperties = {
  background: 'var(--verse-highlight)',
  borderLeft: '3px solid transparent',
  transition: ROW_TRANSITION,
}

type Props = {
  verse: number
  textHtml?: string
  textHtmlSecondary?: string
  secondaryLang?: string
  mode: 'read' | 'select'
  selected: boolean
  onSelect: (verse: number) => void
  onOpen: (verse: number) => void
  commentCount?: number
  highlighted?: boolean
  showNumber?: boolean
}

export function VerseRow({
  verse,
  textHtml,
  textHtmlSecondary,
  secondaryLang,
  mode,
  selected,
  onSelect,
  onOpen,
  commentCount = 0,
  highlighted = false,
  showNumber = true,
}: Props) {
  const containerStyle = selected
    ? ROW_SELECTED_STYLE
    : highlighted
      ? ROW_HIGHLIGHTED_STYLE
      : ROW_UNSELECTED_STYLE

  const numberLabel = showNumber && (
    <span
      className="text-xs font-medium"
      style={{ color: 'var(--sea-ink-soft)' }}
    >
      {verse}
    </span>
  )

  const primaryText = textHtml && (
    <SanitizedVerseHtml
      html={textHtml}
      className={showNumber ? 'ml-2 text-sm' : 'text-sm'}
      style={{ color: 'var(--sea-ink)' }}
    />
  )

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
          {textHtml && textHtmlSecondary ? (
            <div className="flex flex-col gap-1 lg:flex-row lg:gap-4">
              <div className="lg:flex-1">
                {numberLabel}
                {primaryText}
              </div>
              <SanitizedVerseHtml
                html={textHtmlSecondary}
                className="text-sm lg:flex-1"
                style={{ color: 'var(--sea-ink-soft)' }}
                lang={secondaryLang}
              />
            </div>
          ) : (
            <>
              {numberLabel}
              {primaryText}
            </>
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
        className="verse-item w-full text-left"
        // 画面外の節の高さ見積もりを併記の有無で切り替えるため（styles.css の verse-item）
        data-bilingual={textHtmlSecondary ? '' : undefined}
        style={containerStyle}
      >
        {inner}
      </button>
    )
  }

  return (
    <div style={containerStyle} data-highlighted={highlighted || undefined}>
      <button
        type="button"
        onClick={() => onOpen(verse)}
        aria-haspopup="dialog"
        className="verse-item block w-full text-left cursor-pointer"
        data-bilingual={textHtmlSecondary ? '' : undefined}
      >
        {inner}
        {commentCount > 0 && <span className="sr-only">コメント{commentCount}件</span>}
      </button>
    </div>
  )
}
