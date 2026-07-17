import type { ReactNode, KeyboardEvent, MouseEvent } from 'react'
import { Link } from '@tanstack/react-router'
import type { Components } from 'react-markdown'
import { getScriptureLabel, buildScriptureUrl } from '@/shared/lib/scriptureUtils'
import { ANONYMOUS_DISPLAY_NAME } from '@/shared/lib/constants'
import { formatDate } from '@/shared/lib/date'
import { MarkdownRenderer, UserAvatar } from '@/shared/ui'

function NestedLink({ href, className, style, children }: { href: string; className?: string; style?: React.CSSProperties; children: ReactNode }) {
  const open = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.open(href, '_blank', 'noopener,noreferrer')
  }
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') open(e) }}
      className={className ?? 'underline cursor-pointer'}
      style={style}
    >
      {children}
    </span>
  )
}

const NESTED_COMPONENTS: Components = {
  a: ({ href, children }) => (
    <NestedLink href={href ?? '#'} style={{ color: 'var(--lagoon-deep)' }}>
      {children}
    </NestedLink>
  ),
}

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

export const POST_SELECT = `
  id, content, visibility, created_at,
  scripture_collection, scripture_book, scripture_chapter,
  scripture_verses, user_id,
  users ( display_name, avatar_url )
`

export function toScriptureRef(post: PostWithUser) {
  return post.scripture_collection && post.scripture_book && post.scripture_chapter
    ? { collection: post.scripture_collection, book: post.scripture_book, chapter: post.scripture_chapter, verses: post.scripture_verses ?? undefined }
    : null
}

type Props = { post: PostWithUser }

export function PostCard({ post }: Props) {
  const displayName = post.users?.display_name ?? ANONYMOUS_DISPLAY_NAME
  const avatarUrl = post.users?.avatar_url ?? null

  const scriptureRef = toScriptureRef(post)
  const scriptureLabel = scriptureRef ? getScriptureLabel(scriptureRef) : null
  const scriptureUrl = scriptureRef ? buildScriptureUrl(scriptureRef) : null

  return (
    <Link to="/posts/$id" params={{ id: post.id }} className="block">
      <article className="px-4 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-start gap-3 mb-2">
          <UserAvatar name={displayName} url={avatarUrl} size="sm" />
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
              <NestedLink
                href={scriptureUrl}
                className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer"
                style={{ background: 'var(--chip-bg)', border: '1px solid var(--chip-line)', color: 'var(--palm)' }}
              >
                <span aria-hidden="true">📖</span> {scriptureLabel}
              </NestedLink>
            )}
          </div>
        </div>
        <div className="ml-12" style={{ color: 'var(--sea-ink)' }}>
          <MarkdownRenderer content={post.content} components={NESTED_COMPONENTS} />
        </div>
      </article>
    </Link>
  )
}
