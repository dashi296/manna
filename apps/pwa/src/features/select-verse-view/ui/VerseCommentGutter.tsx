import { useRef } from 'react'
import { UserAvatar } from '@/shared/ui'
import type { AvatarStackItem } from '@/shared/ui'

const MAX_AVATARS = 3
// タッチにはホバーがないため、押している間のハイライトを「範囲を見る」操作として使う。
// これを超えて押し続けた場合は、指を離してもシートを開かない
const LONG_PRESS_MS = 400

// 節本文の右に確保する固定幅。件数が増えても行の高さが変わらないよう、
// 幅は常に一定で、中身だけが「印あり／なし」に切り替わる
export const VERSE_GUTTER_WIDTH = 'w-12 lg:w-20'

export type VerseGutterEntry = {
  anchoredCount: number
  coveredCount: number
  commenters: AvatarStackItem[]
  highlightVerses?: number[]
}

type Props = {
  verse: number
  entry: VerseGutterEntry | undefined
  onOpen: (verse: number) => void
  onHighlight?: (verses: number[] | null) => void
}

export function VerseCommentGutter({ verse, entry, onOpen, onHighlight }: Props) {
  const pressStartedAt = useRef(0)

  if (!entry || entry.coveredCount === 0) {
    return <div className={`${VERSE_GUTTER_WIDTH} shrink-0`} aria-hidden="true" />
  }

  const isAnchor = entry.anchoredCount > 0
  const label = isAnchor
    ? `${verse}節から始まるコメント ${entry.coveredCount}件を見る`
    : `${verse}節を含むコメント ${entry.coveredCount}件を見る`
  const avatars = entry.commenters.slice(0, MAX_AVATARS)
  const highlight = entry.highlightVerses?.length ? entry.highlightVerses : null

  return (
    <div className={`${VERSE_GUTTER_WIDTH} shrink-0 self-stretch`}>
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          const heldFor = Date.now() - pressStartedAt.current
          pressStartedAt.current = 0
          if (heldFor < LONG_PRESS_MS) onOpen(verse)
        }}
        onPointerDown={() => {
          pressStartedAt.current = Date.now()
        }}
        onPointerEnter={() => onHighlight?.(highlight)}
        onPointerLeave={() => onHighlight?.(null)}
        // 押したままスクロールに移ると pointercancel だけが来て pointerleave が来ない
        onPointerCancel={() => {
          pressStartedAt.current = 0
          onHighlight?.(null)
        }}
        onFocus={() => onHighlight?.(highlight)}
        onBlur={() => onHighlight?.(null)}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full flex items-start justify-start gap-1 pl-1 pt-3 select-none"
        style={{ WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
      >
        {avatars.map((c, i) => (
          <span
            key={c.userId}
            className={i === 0 ? '' : '-ml-2 hidden lg:block'}
            style={{ zIndex: avatars.length - i }}
          >
            <UserAvatar name={c.name} url={c.avatarUrl} size="2xs" />
          </span>
        ))}
        {entry.anchoredCount >= 2 && (
          <span className="text-[11px] leading-6" style={{ color: 'var(--sea-ink-soft)' }}>
            {entry.anchoredCount}
          </span>
        )}
      </button>
    </div>
  )
}
