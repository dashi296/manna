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
  // pointerup の時点で押下時間を確定させる。タッチでは pointerleave が click より
  // 先に来るため、leave 側で押下時間ごと捨てると長押しが判定できなくなる
  const lastPressDuration = useRef<number | null>(null)

  // 印を置くのはアンカー節だけ。範囲の途中の節にボタンを置くと、見た目が空のまま
  // フォーカスできる地点がキーボード利用者の前に並んでしまう
  if (!entry || entry.anchoredCount === 0) {
    return <div className={`${VERSE_GUTTER_WIDTH} shrink-0`} aria-hidden="true" />
  }

  // 件数はラベルに入れない。視覚表示はこの節から始まる件数（anchoredCount）だが、
  // シートに出るのはこの節に関わる全件（coveredCount）で、両者は一致しない
  const label = `${verse}節のコメントを見る`
  const avatars = entry.commenters.slice(0, MAX_AVATARS)
  const highlight = entry.highlightVerses?.length ? entry.highlightVerses : null

  return (
    <div className={`${VERSE_GUTTER_WIDTH} shrink-0 self-stretch`}>
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          // キーボードの Enter/Space は pointerdown を伴わないため押下時間が無い。
          // その場合は長押しではないものとして扱う
          const heldFor = lastPressDuration.current
          lastPressDuration.current = null
          if (heldFor === null || heldFor < LONG_PRESS_MS) onOpen(verse)
        }}
        onPointerDown={() => {
          pressStartedAt.current = Date.now()
          lastPressDuration.current = null
        }}
        onPointerUp={() => {
          if (pressStartedAt.current === 0) return
          lastPressDuration.current = Date.now() - pressStartedAt.current
          pressStartedAt.current = 0
        }}
        onPointerEnter={() => onHighlight?.(highlight)}
        onPointerLeave={() => {
          // 押しかけて外へ移動した場合。確定済みの押下時間は tap の一部なので残す
          pressStartedAt.current = 0
          onHighlight?.(null)
        }}
        // 押したままスクロールに移ると pointercancel だけが来て pointerleave が来ない
        onPointerCancel={() => {
          pressStartedAt.current = 0
          lastPressDuration.current = null
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
