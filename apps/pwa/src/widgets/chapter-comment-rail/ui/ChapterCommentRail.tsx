import type { PostWithUser } from '@/entities/post'
import { CompactPostCard } from '@/shared/ui'

type Props = {
  posts: PostWithUser[]
  selectedUserName: string
}

export function ChapterCommentRail({ posts, selectedUserName }: Props) {
  if (posts.length === 0) return null

  return (
    <aside
      className="w-80 shrink-0 border-l pl-4 pr-2 py-3"
      style={{ borderColor: 'var(--line)' }}
    >
      <h2
        className="text-xs font-semibold mb-2"
        style={{ color: 'var(--sea-ink-soft)' }}
      >
        {selectedUserName}のコメント
      </h2>
      <div className="flex flex-col gap-2">
        {posts.map((p) => (
          <CompactPostCard key={p.id} post={p} />
        ))}
      </div>
    </aside>
  )
}
