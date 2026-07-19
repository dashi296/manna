import { CompactPostCard, type PostWithUser } from '@/entities/post'

type Props = {
  posts: PostWithUser[]
  selectedUserName: string
}

export function ChapterCommentRail({ posts, selectedUserName }: Props) {
  if (posts.length === 0) return null

  return (
    <aside className="px-4 py-3">
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
