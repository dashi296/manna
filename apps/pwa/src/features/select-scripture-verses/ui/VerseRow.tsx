import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { SanitizedVerseHtml } from '@/shared/ui'

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
  /** 行の右端に添える印。行のボタンの内側に置き、タップ対象を行全体にする */
  marker?: ReactNode
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
  marker,
}: Props) {
  const numberLabel = showNumber && (
    <span className="text-xs font-medium text-muted-foreground">{verse}</span>
  )

  const primaryText = textHtml && (
    <SanitizedVerseHtml
      html={textHtml}
      className={showNumber ? 'ml-2 text-sm text-foreground' : 'text-sm text-foreground'}
    />
  )

  const inner = (
    <div className="flex items-start gap-2 px-4 py-3">
      {mode === 'select' && (
        <div
          aria-hidden="true"
          className="verse-check shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
          data-selected={selected || undefined}
        >
          {selected && <Check size={12} strokeWidth={3} color="#fff" aria-hidden="true" />}
        </div>
      )}
      <div className="flex-1 min-w-0 flex items-start justify-between gap-2 text-foreground">
        <div className="flex-1 min-w-0">
          {textHtml && textHtmlSecondary ? (
            <div className="flex flex-col gap-1 lg:flex-row lg:gap-4">
              <div className="lg:flex-1">
                {numberLabel}
                {primaryText}
              </div>
              <SanitizedVerseHtml
                html={textHtmlSecondary}
                className="text-sm lg:flex-1 text-muted-foreground"
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
        // 節1行まるごとが対象なので input には置き換えられない。
        // button + role=checkbox + aria-checked は正規の ARIA パターン
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="checkbox"
        aria-checked={selected}
        aria-label={`${verse}節を選択`}
        onClick={() => onSelect(verse)}
        className="verse-item verse-row block w-full text-left cursor-pointer"
        // 画面外の節の高さ見積もりを併記の有無で切り替えるため（styles.css の verse-item）
        data-bilingual={textHtmlSecondary ? '' : undefined}
        data-selected={selected || undefined}
        data-highlighted={highlighted || undefined}
      >
        {inner}
      </button>
    )
  }

  return (
    <div
      className="verse-row"
      data-selected={selected || undefined}
      data-highlighted={highlighted || undefined}
    >
      <button
        type="button"
        onClick={() => onOpen(verse)}
        aria-haspopup="dialog"
        className="flex w-full items-stretch text-left cursor-pointer"
      >
        {/* content-visibility は paint containment も伴うため、verse-item はここに
            付ける。button に付けると、印のバッジ（-right-1）が ul の pr-1 まで
            はみ出せずボタンの右端で切られる */}
        <div
          className="verse-item flex-1 min-w-0"
          data-bilingual={textHtmlSecondary ? '' : undefined}
        >
          {inner}
        </div>
        {marker}
        {commentCount > 0 && <span className="sr-only">コメント{commentCount}件</span>}
      </button>
    </div>
  )
}
