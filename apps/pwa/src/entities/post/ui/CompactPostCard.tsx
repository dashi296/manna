import { Link } from '@tanstack/react-router'
import { toScriptureRef, type PostWithUser } from '../model'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { formatDate } from '@/shared/lib/date'
import { getScriptureLabel } from '@/shared/lib/scriptureUtils'
import { UserAvatar } from '@/shared/ui'

type Props = {
  post: PostWithUser
}

export function CompactPostCard({ post }: Props) {
  const { displayName, avatarUrl } = resolveUserIdentity(post.users)
  const scriptureRef = toScriptureRef(post)
  const scriptureLabel = scriptureRef ? getScriptureLabel(scriptureRef) : null

  return (
    <Link
      to="/posts/$id"
      params={{ id: post.id }}
      className="block px-3 py-2 rounded-lg no-underline"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      aria-label={`${displayName}: ${post.content}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <UserAvatar name={displayName} url={avatarUrl} size="xs" />
        <span className="text-xs font-medium text-foreground">{displayName}</span>
        <time className="text-xs ml-auto text-muted-foreground">{formatDate(post.created_at)}</time>
      </div>
      <p
        className="text-sm whitespace-pre-wrap break-words text-foreground"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {post.content}
      </p>
      {scriptureLabel && <div className="mt-1 text-xs text-primary">📖 {scriptureLabel}</div>}
    </Link>
  )
}
