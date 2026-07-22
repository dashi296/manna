import type { PostWithUser } from '../model'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { CompactPostCard } from './CompactPostCard'

type Props = {
  post: PostWithUser
}

export function CommenterBubble({ post }: Props) {
  const { displayName } = resolveUserIdentity(post.users)
  return (
    <div
      role="group"
      aria-label={`${displayName}の吹き出し`}
      className="relative rounded-lg"
      style={{
        background: 'var(--chip-bg)',
        border: '1px solid var(--chip-line)',
      }}
    >
      <span
        aria-hidden="true"
        className="hidden lg:block absolute left-[-6px] top-4 w-3 h-3 rotate-45"
        style={{
          background: 'var(--chip-bg)',
          borderLeft: '1px solid var(--chip-line)',
          borderBottom: '1px solid var(--chip-line)',
        }}
      />
      <CompactPostCard post={post} />
    </div>
  )
}
