import type { CSSProperties } from 'react'
import { UserAvatar } from '@/shared/ui'
import type { AvatarStackItem } from '@/shared/ui'

const MAX_AVATARS = 3

// 節本文の右に確保する固定幅。件数が増えても行の高さが変わらないよう、
// 幅は常に一定で、中身だけが「印あり／なし」に切り替わる。
// 件数はアイコンに重ねるので、幅はアイコンぶんだけで足りる。
// バッジのはみ出し 4px はページ側の余白（節一覧の pr-1）に逃がし、幅には数えない。
// lg は最大構成（24px アバター3枚の重ね = 56px）が収まる幅にする
const VERSE_MARKER_WIDTH = 'w-6 lg:w-14'

export type VerseMarkerEntry = {
  anchoredCount: number
  commenters: AvatarStackItem[]
}

// 目印であって操作子ではない。節に関する操作は行全体のタップに集約している
export function VerseCommentMarker({ entry }: { entry: VerseMarkerEntry | undefined }) {
  if (!entry || entry.anchoredCount === 0) {
    return <div className={`${VERSE_MARKER_WIDTH} shrink-0`} aria-hidden="true" />
  }

  const avatars = entry.commenters.slice(0, MAX_AVATARS)

  return (
    <div className={`${VERSE_MARKER_WIDTH} shrink-0 self-stretch pt-3`} aria-hidden="true">
      <div className="relative flex w-fit items-center select-none">
        {avatars.map((c, i) => (
          <span
            key={c.userId}
            className={`z-(--stack-z) ${i === 0 ? '' : '-ml-2 hidden lg:block'}`}
            style={{ '--stack-z': String(avatars.length - i) } as CSSProperties}
          >
            <UserAvatar name={c.name} url={c.avatarUrl} size="2xs" />
          </span>
        ))}
        {entry.anchoredCount >= 2 && (
          // 通知バッジと同じ置き方。横に並べるとその分だけ列が広がる。
          // 10px の小さい文字なのでコントラストは 4.5:1 が要る。白文字＋lagoon-deep
          // では 3.81 で足りず、lagoon 地に sea-ink の文字で 5.15 にしている。
          // アバターは flex アイテムに z-index を持つ（static でも効く）ので、
          // それより前に出さないとバッジが下に潜る
          <span
            className="absolute -top-1 -right-1 z-(--stack-z) flex h-4 min-w-4 items-center justify-center rounded-full bg-lagoon px-1 text-3xs leading-none font-medium text-foreground"
            style={{ '--stack-z': String(avatars.length + 1) } as CSSProperties}
          >
            {entry.anchoredCount}
          </span>
        )}
      </div>
    </div>
  )
}
