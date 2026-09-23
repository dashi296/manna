import { memo } from 'react'
import type { ReactNode, KeyboardEvent, MouseEvent } from 'react'
import { Link } from '@tanstack/react-router'
import type { Components } from 'react-markdown'
import { toScriptureRef, type PostWithUser } from '../model'
import { findBook, getScriptureLabel, buildScriptureUrl } from '@/shared/lib/scriptureUtils'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { formatDate } from '@/shared/lib/date'
import { MarkdownRenderer, UserAvatar } from '@/shared/ui'

function NestedLink({
  href,
  className,
  style,
  children,
}: {
  href: string
  className?: string
  style?: React.CSSProperties
  children: ReactNode
}) {
  const open = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.open(href, '_blank', 'noopener,noreferrer')
  }
  return (
    <span
      // カード全体が <Link>（= <a>）なので中に <a> は置けない。ただし
      // span + role=link + tabIndex も <a> の子孫として不正で、これは
      // 誤検知ではなく既知の a11y 問題（#186）。カード側の構造から直す必要がある
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') open(e)
      }}
      className={className ?? 'underline cursor-pointer'}
      style={style}
    >
      {children}
    </span>
  )
}

const NESTED_COMPONENTS: Components = {
  a: ({ href, children }) => (
    <NestedLink className="underline cursor-pointer text-primary" href={href ?? '#'}>
      {children}
    </NestedLink>
  ),
}

type Props = { post: PostWithUser }

// 「もっと見る」で一覧が伸びるため、押すたびに既存カード全部の markdown を
// 再パースしないよう memo する（react-markdown 側にメモ化は無い）
export const PostCard = memo(function PostCard({ post }: Props) {
  const { displayName, avatarUrl } = resolveUserIdentity(post.users)

  const scriptureRef = toScriptureRef(post)
  const scriptureBook = scriptureRef ? findBook(scriptureRef) : undefined
  const scriptureLabel = scriptureRef ? getScriptureLabel(scriptureRef, scriptureBook) : null
  const scriptureUrl = scriptureRef ? buildScriptureUrl(scriptureRef, scriptureBook) : null

  return (
    <Link to="/posts/$id" params={{ id: post.id }} className="block">
      <article className="px-4 py-4 border-b border-border">
        <div className="flex items-start gap-3 mb-2">
          <UserAvatar name={displayName} url={avatarUrl} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold truncate text-foreground">{displayName}</span>
              <time dateTime={post.created_at} className="text-xs shrink-0 text-muted-foreground">
                {formatDate(post.created_at)}
              </time>
            </div>
            {scriptureLabel && scriptureUrl && (
              <NestedLink
                href={scriptureUrl}
                className="inline-flex items-center mt-0.5 rounded-full border border-chip-line bg-chip px-2 py-0.5 text-2xs font-medium cursor-pointer text-secondary"
              >
                <span aria-hidden="true">📖</span> {scriptureLabel}
              </NestedLink>
            )}
          </div>
        </div>
        <div className="ml-12 text-foreground">
          <MarkdownRenderer content={post.content} components={NESTED_COMPONENTS} />
        </div>
      </article>
    </Link>
  )
})
