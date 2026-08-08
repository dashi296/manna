import { useState } from 'react'
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { POST_SELECT, toScriptureRef, type PostWithUser } from '@/entities/post'
import { getScriptureLabel, buildScriptureUrl, getBook } from '@/entities/scripture'
import { invalidatePostLists } from '@/entities/user'
import { PostActionsMenu } from '@/features/manage-post'
import { PostComposerSheet } from '@/widgets/post-composer-sheet'
import { MarkdownRenderer, PageHeader, UserAvatar } from '@/shared/ui'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { formatDate } from '@/shared/lib/date'
import { createSupabaseServer } from '@/shared/lib/auth'

const fetchPost = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async (ctx) => {
    const serverSupabase = await createSupabaseServer()
    // maybeSingle は0件を null で返すので loader が 404 にできる。single だと0件も
    // error になり、throwOnError と併せると 404 が 500 に化ける
    const [{ data: post }, { data: { user } }] = await Promise.all([
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('id', ctx.data.id)
        .maybeSingle()
        .throwOnError(),
      serverSupabase.auth.getUser(),
    ])
    return { post: post as PostWithUser | null, viewerId: user?.id ?? null }
  })

export const Route = createFileRoute('/posts/$id')({
  loader: async ({ params }) => {
    const { post, viewerId } = await fetchPost({ data: { id: params.id } })
    if (!post) throw notFound()
    return { post, viewerId }
  },
  component: PostDetailPage,
})

function PostDetailPage() {
  const { post, viewerId } = Route.useLoaderData()
  const { displayName, avatarUrl } = resolveUserIdentity(post.users)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const isOwner = viewerId !== null && viewerId === post.user_id
  const isEdited = post.updated_at !== post.created_at

  const scriptureRef = toScriptureRef(post)
  const scriptureBook = scriptureRef ? getBook(scriptureRef.collection, scriptureRef.book) : undefined
  const scriptureLabel = scriptureRef ? getScriptureLabel(scriptureRef, scriptureBook) : null
  const officialUrl = scriptureRef ? buildScriptureUrl(scriptureRef, scriptureBook) : null

  // PostEditor は更新成功時もキャンセル時も onOpenChange(false) を通るため、
  // 閉じたら常に取り直す。キャンセル時の1回は無駄になるが、更新の取りこぼしより安い
  const handleEditorOpenChange = (open: boolean) => {
    setEditing(open)
    if (open) return
    invalidatePostLists(queryClient)
    router.invalidate()
  }

  return (
    <div>
      <PageHeader
        title="投稿"
        backTo="/"
        backLabel="フィード"
        action={
          isOwner ? <PostActionsMenu postId={post.id} onEdit={() => setEditing(true)} /> : undefined
        }
      />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <UserAvatar name={displayName} url={avatarUrl} size="md" />
          <div>
            <span className="font-semibold text-sm" style={{ color: 'var(--sea-ink)' }}>
              {displayName}
            </span>
            <div className="text-xs" style={{ color: 'var(--sea-ink-soft)' }}>
              {formatDate(post.created_at, { year: true })}
              {isEdited && <span>・編集済み</span>}
            </div>
          </div>
        </div>

        {scriptureRef && scriptureLabel && officialUrl && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--chip-bg)', border: '1px solid var(--chip-line)' }}>
            <Link
              to="/scriptures/$collection/$book/$chapter"
              params={{
                collection: scriptureRef.collection,
                book: scriptureRef.book,
                chapter: String(scriptureRef.chapter),
              }}
              search={scriptureRef.verses ? { verses: scriptureRef.verses } : {}}
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

        {isOwner && (
          <PostComposerSheet
            open={editing}
            onOpenChange={handleEditorOpenChange}
            post={{ id: post.id, content: post.content, visibility: post.visibility }}
            initialScripture={scriptureRef ?? undefined}
          />
        )}
      </div>
    </div>
  )
}
