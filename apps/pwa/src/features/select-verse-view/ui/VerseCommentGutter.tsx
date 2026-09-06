import { UserAvatar } from '@/shared/ui'
import type { AvatarStackItem } from '@/shared/ui'

const MAX_AVATARS = 3

// 節本文の右に確保する固定幅。件数が増えても行の高さが変わらないよう、
// 幅は常に一定で、中身だけが「印あり／縦線のみ／空」に切り替わる
export const VERSE_GUTTER_WIDTH = 'w-12 lg:w-20'

export type VerseGutterEntry = {
  anchoredCount: number
  coveredCount: number
  commenters: AvatarStackItem[]
  spanning?: boolean
}

type Props = {
  verse: number
  entry: VerseGutterEntry | undefined
  onOpen: (verse: number) => void
}

export function VerseCommentGutter({ verse, entry, onOpen }: Props) {
  if (!entry || entry.coveredCount === 0) {
    return <div className={`${VERSE_GUTTER_WIDTH} shrink-0`} aria-hidden="true" />
  }

  const isAnchor = entry.anchoredCount > 0
  const label = isAnchor
    ? `${verse}節から始まるコメント ${entry.coveredCount}件を見る`
    : `${verse}節を含むコメント ${entry.coveredCount}件を見る`
  const avatars = entry.commenters.slice(0, MAX_AVATARS)

  return (
    <div className={`${VERSE_GUTTER_WIDTH} shrink-0 self-stretch relative`}>
      {entry.spanning && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-2 w-0.5 rounded-full"
          style={{ background: 'var(--lagoon)', opacity: 0.35 }}
        />
      )}
      <button
        type="button"
        aria-label={label}
        onClick={() => onOpen(verse)}
        className="relative w-full h-full flex items-start justify-start gap-1 pl-1 pt-3"
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
