import { memo, useRef, type MouseEvent } from 'react'
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
      className="underline text-primary"
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
  const dateLinkRef = useRef<HTMLAnchorElement>(null)

  // カード全体を <a> で包むと中のリンクが入れ子になる（#186）。覆いで全面を押せるようにすると
  // 本文を選択できない（#198）。日付だけを本物のリンクにし、カードのクリックをそこへ渡す
  const openPost = (e: MouseEvent<HTMLElement>) => {
    if (!(e.target instanceof Element) || e.target.closest('a, button')) return
    if (window.getSelection()?.toString()) return
    const link = dateLinkRef.current
    if (!link) return
    // 合成したクリックでは、修飾キーを付けてもブラウザが新しいタブで開かない
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      window.open(link.href, '_blank', 'noopener')
      return
    }
    link.click()
  }

  return (
    // キーボードと読み上げでは日付のリンクで開ける。クリックは指やマウスの近道でしかない
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <article onClick={openPost} className="cursor-pointer px-4 py-4 border-b border-border">
      <div className="flex items-start gap-3 mb-2">
        <UserAvatar name={displayName} url={avatarUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold truncate text-foreground">{displayName}</span>
            <Link
              ref={dateLinkRef}
              to="/posts/$id"
              params={{ id: post.id }}
              aria-label={`${displayName} の投稿（${postedAt}）`}
              className="text-xs shrink-0 text-muted-foreground"
            >
              <time dateTime={post.created_at}>{postedAt}</time>
            </Link>
          </div>
          {scriptureLabel && scriptureUrl && (
            <a
              href={scriptureUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center mt-0.5 rounded-full border border-chip-line bg-chip px-2 py-0.5 text-2xs font-medium text-secondary"
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
