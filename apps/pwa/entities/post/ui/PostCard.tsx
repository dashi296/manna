import { getScriptureLabel, buildScriptureUrl } from '@/entities/scripture'

export type PostWithUser = {
  id: string
  content: string
  visibility: string
  created_at: string
  scripture_collection: string | null
  scripture_book: string | null
  scripture_chapter: number | null
  scripture_verses: number[] | null
  user_id: string
  users: { display_name: string | null; avatar_url: string | null } | null
}

type Props = { post: PostWithUser }

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

function Initials({ name }: { name: string }) {
  const ch = name.charAt(0).toUpperCase()
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{ background: 'var(--lagoon)', color: '#fff' }}
      aria-hidden
    >
      {ch}
    </div>
  )
}

export function PostCard({ post }: Props) {
  const displayName = post.users?.display_name ?? '匿名ユーザー'
  const avatarUrl = post.users?.avatar_url

  const scriptureLabel =
    post.scripture_collection && post.scripture_book && post.scripture_chapter
      ? getScriptureLabel({
          collection: post.scripture_collection,
          book: post.scripture_book,
          chapter: post.scripture_chapter,
          verses: post.scripture_verses ?? undefined,
        })
      : null

  const scriptureUrl =
    post.scripture_collection && post.scripture_book && post.scripture_chapter
      ? buildScriptureUrl({
          collection: post.scripture_collection,
          book: post.scripture_book,
          chapter: post.scripture_chapter,
          verses: post.scripture_verses ?? undefined,
        })
      : null

  return (
    <article className="px-4 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-start gap-3 mb-2">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
        ) : (
          <Initials name={displayName} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--sea-ink)' }}>
              {displayName}
            </span>
            <time
              dateTime={post.created_at}
              className="text-xs shrink-0"
              style={{ color: 'var(--sea-ink-soft)' }}
            >
              {formatDate(post.created_at)}
            </time>
          </div>
          {scriptureLabel && scriptureUrl && (
            <a
              href={scriptureUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{
                background: 'var(--chip-bg)',
                border: '1px solid var(--chip-line)',
                color: 'var(--palm)',
              }}
            >
              📖 {scriptureLabel}
            </a>
          )}
        </div>
      </div>
      <p
        className="text-sm leading-relaxed whitespace-pre-wrap ml-12"
        style={{ color: 'var(--sea-ink)' }}
      >
        {post.content}
      </p>
    </article>
  )
}
