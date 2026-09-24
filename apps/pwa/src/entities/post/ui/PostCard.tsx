import { memo } from 'react'
import type { Components } from 'react-markdown'
import { Link } from '@tanstack/react-router'
import { toScriptureRef, type PostWithUser } from '../model'
import { findBook, getScriptureLabel, buildScriptureUrl } from '@/shared/lib/scriptureUtils'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { formatDate } from '@/shared/lib/date'
import { MarkdownRenderer, UserAvatar } from '@/shared/ui'

// 本文の URL は投稿者が書いたもの。外部へ出るので別タブにする
const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a
      href={href ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="relative z-10 underline text-primary"
    >
      {children}
    </a>
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
  const postedAt = formatDate(post.created_at)

  return (
    // カード全体を <a> で包むと、中のリンクが入れ子の対話要素になり、
    // 外側のリンク自体もアクセシブル名を失う（#186）。日付だけを本物のリンクにして、
    // その ::after でカード全面を覆う。中のリンクは z-index で上に出す。
    // isolate が無いと、その z-index が sticky ヘッダー（同じ z-10）と張り合い、
    // スクロールで重なったときにカードのリンクが前面へ出る
    <article className="relative isolate px-4 py-4 border-b border-border">
      <div className="flex items-start gap-3 mb-2">
        <UserAvatar name={displayName} url={avatarUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold truncate text-foreground">{displayName}</span>
            <Link
              to="/posts/$id"
              params={{ id: post.id }}
              aria-label={`${displayName} の投稿（${postedAt}）`}
              className="post-card-open text-xs shrink-0 text-muted-foreground"
            >
              <time dateTime={post.created_at}>{postedAt}</time>
            </Link>
          </div>
          {scriptureLabel && scriptureUrl && (
            <a
              href={scriptureUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 inline-flex items-center mt-0.5 rounded-full border border-chip-line bg-chip px-2 py-0.5 text-2xs font-medium text-secondary"
            >
              <span aria-hidden="true">📖</span> {scriptureLabel}
            </a>
          )}
        </div>
      </div>
      <div className="ml-12 text-foreground">
        <MarkdownRenderer content={post.content} components={MARKDOWN_COMPONENTS} />
      </div>
    </article>
  )
})
