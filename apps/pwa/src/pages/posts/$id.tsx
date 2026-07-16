import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { MarkdownRenderer, PageHeader } from '@/shared/ui'
import { createSupabaseServer } from '@/shared/lib/auth'
import { getScriptureLabel, buildScriptureUrl } from '@/shared/lib/scriptureUtils'
import type { PostWithUser } from '@/entities/post'

const POST_SELECT = `
  id, content, visibility, created_at,
  scripture_collection, scripture_book, scripture_chapter,
  scripture_verses, user_id,
  users ( display_name, avatar_url )
`

const fetchPost = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async (ctx) => {
    const serverSupabase = await createSupabaseServer()
    const { data: post } = await serverSupabase
      .from('posts')
      .select(POST_SELECT)
      .eq('id', ctx.data.id)
      .single()
    return (post ?? null) as PostWithUser | null
  })

export const Route = createFileRoute('/posts/$id')({
  loader: async ({ params }) => {
    const post = await fetchPost({ data: { id: params.id } })
    if (!post) throw notFound()
    return { post }
  },
  component: PostDetailPage,
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  })
}

function PostDetailPage() {
  const { post } = Route.useLoaderData()
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

  const officialUrl =
    post.scripture_collection && post.scripture_book && post.scripture_chapter
      ? buildScriptureUrl({
          collection: post.scripture_collection,
          book: post.scripture_book,
          chapter: post.scripture_chapter,
          verses: post.scripture_verses ?? undefined,
        })
      : null

  return (
    <div>
      <PageHeader title="投稿" backTo="/" backLabel="フィード" />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--lagoon)', color: '#fff' }}
              aria-hidden="true"
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-semibold text-sm" style={{ color: 'var(--sea-ink)' }}>
              {displayName}
            </span>
            <div className="text-xs" style={{ color: 'var(--sea-ink-soft)' }}>
              {formatDate(post.created_at)}
            </div>
          </div>
        </div>

        {scriptureLabel && officialUrl && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--chip-bg)', border: '1px solid var(--chip-line)' }}>
            <Link
              to="/scriptures/$collection/$book/$chapter"
              params={{
                collection: post.scripture_collection!,
                book: post.scripture_book!,
                chapter: String(post.scripture_chapter!),
              }}
              search={post.scripture_verses ? { verses: post.scripture_verses } : {}}
              className="font-medium text-sm"
              style={{ color: 'var(--palm)' }}
            >
              📖 {scriptureLabel}
            </Link>
            <div className="mt-1">
              <a
                href={officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
                style={{ color: 'var(--lagoon-deep)' }}
              >
                公式サイトで読む →
              </a>
            </div>
          </div>
        )}

        <MarkdownRenderer content={post.content} />
      </div>
    </div>
  )
}
