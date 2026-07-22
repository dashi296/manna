import type { AvatarStackItem } from '@/shared/ui'
import { UserAvatar } from '@/shared/ui'

type Props = {
  commenters: AvatarStackItem[]
  selectedUserId: string | null
  onSelect: (userId: string) => void
  onClear: () => void
}

export function ChapterCommentersRow({
  commenters,
  selectedUserId,
  onSelect,
  onClear,
}: Props) {
  if (commenters.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--sea-ink-soft)' }}>
        フォロー中／家族のこの章への投稿はまだありません
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <div className="flex items-center gap-1 shrink-0">
        {commenters.map((c) => {
          const active = c.userId === selectedUserId
          return (
            <button
              key={c.userId}
              type="button"
              aria-pressed={active}
              aria-label={`${c.name} を選ぶ`}
              onClick={() => onSelect(c.userId)}
              className="rounded-full transition-shadow"
              style={{
                boxShadow: active ? '0 0 0 2px var(--lagoon)' : 'none',
              }}
            >
              <UserAvatar name={c.name} url={c.avatarUrl} size="xs" />
            </button>
          )
        })}
      </div>
      {selectedUserId && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs shrink-0 underline"
          style={{ color: 'var(--lagoon-deep)' }}
        >
          選択解除
        </button>
      )}
    </div>
  )
}
