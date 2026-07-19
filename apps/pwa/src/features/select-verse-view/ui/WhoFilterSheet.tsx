import { Check } from 'lucide-react'
import type { AvatarStackItem } from '@/shared/ui/AvatarStack'
import { UserAvatar } from '@/shared/ui'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'

export type CircleUser = AvatarStackItem

type Props = {
  open: boolean
  users: CircleUser[]
  isIncluded: (userId: string) => boolean
  onToggle: (userId: string) => void
  onSetAll: (userIds: string[], include: boolean) => void
  onOpenChange: (open: boolean) => void
}

export function WhoFilterSheet({
  open,
  users,
  isIncluded,
  onToggle,
  onSetAll,
  onOpenChange,
}: Props) {
  const ids = users.map((u) => u.userId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>表示するユーザー</SheetTitle>
        </SheetHeader>
        {users.length === 0 ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
            フォロー中／家族の投稿がここに表示されます
          </p>
        ) : (
          <>
            <div className="flex gap-3 px-4 py-2">
              <button
                type="button"
                onClick={() => onSetAll(ids, true)}
                className="text-xs underline"
                style={{ color: 'var(--lagoon-deep)' }}
              >
                すべて選択
              </button>
              <button
                type="button"
                onClick={() => onSetAll(ids, false)}
                className="text-xs underline"
                style={{ color: 'var(--lagoon-deep)' }}
              >
                すべて解除
              </button>
            </div>
            <ul className="pb-4">
              {users.map((u) => {
                const checked = isIncluded(u.userId)
                return (
                  <li key={u.userId}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={`${u.name}を表示`}
                      onClick={() => onToggle(u.userId)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left"
                    >
                      <span
                        aria-hidden="true"
                        className="shrink-0 w-5 h-5 rounded flex items-center justify-center"
                        style={{
                          border: `1.5px solid ${checked ? 'var(--lagoon)' : 'var(--line)'}`,
                          background: checked ? 'var(--lagoon)' : 'transparent',
                        }}
                      >
                        {checked && <Check size={12} strokeWidth={3} color="#fff" />}
                      </span>
                      <UserAvatar name={u.name} url={u.avatarUrl} size="xs" />
                      <span className="text-sm" style={{ color: 'var(--sea-ink)' }}>
                        {u.name}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
