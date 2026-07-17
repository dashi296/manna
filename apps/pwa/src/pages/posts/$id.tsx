import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { POST_SELECT, toScriptureRef, type PostWithUser } from '@/entities/post'
import { getScriptureLabel, buildScriptureUrl } from '@/entities/scripture'
import { MarkdownRenderer, PageHeader, UserAvatar } from '@/shared/ui'
import { ANONYMOUS_DISPLAY_NAME } from '@/shared/lib/constants'
import { formatDate } from '@/shared/lib/date'
import { createSupabaseServer } from '@/shared/lib/auth'

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

function PostDetailPage() {
  const { post } = Route.useLoaderData()
  const displayName = post.users?.display_name ?? ANONYMOUS_DISPLAY_NAME
  const avatarUrl = post.users?.avatar_url ?? null

  const scriptureRef = toScriptureRef(post)
  const scriptureLabel = scriptureRef ? getScriptureLabel(scriptureRef) : null
  const officialUrl = scriptureRef ? buildScriptureUrl(scriptureRef) : null

  return (
    <div>
      <PageHeader title="投稿" backTo="/" backLabel="フィード" />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <UserAvatar name={displayName} url={avatarUrl} size="md" />
          <div>
            <span className="font-semibold text-sm" style={{ color: 'var(--sea-ink)' }}>
              {displayName}
            </span>
            <div className="text-xs" style={{ color: 'var(--sea-ink-soft)' }}>
              {formatDate(post.created_at, { year: true })}
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
