import { useEffect, useRef } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { CompactPostCard, type PostWithUser } from '@/entities/post'
import { verseHtmlToPlainText } from '@/entities/scripture'
import { copyText } from '@/shared/lib/clipboard'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { toast } from '@/shared/ui/sonner'
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from '@/shared/ui/drawer'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = {
  open: boolean
  verse: number
  label: string
  officialUrl: string
  textHtml?: string
  posts: PostWithUser[]
  onOpenChange: (open: boolean) => void
  onHighlight?: (verses: number[] | null) => void
  canCompose?: boolean
  onCompose?: (verse: number) => void
}

export function VerseCommentSheet({
  open,
  verse,
  label,
  officialUrl,
  textHtml,
  posts,
  onOpenChange,
  onHighlight,
  canCompose = false,
  onCompose,
}: Props) {
  const isMobile = useIsMobile()

  // 閉じたとき・アンマウント時に塗りが残らないようにする。閉じた後もマウントしたまま
  // 退出アニメーションを見せる使い方があるため、open の変化でも解除する。
  // onHighlight は毎描画で作り直されることがあるため、ref 経由で読んでクリーンアップの再実行を避ける
  const highlightRef = useRef(onHighlight)
  useEffect(() => {
    highlightRef.current = onHighlight
  })
  useEffect(() => {
    if (!open) return
    return () => highlightRef.current?.(null)
  }, [open])

  const onCopy = async () => {
    if (!textHtml) return
    const ok = await copyText(`${label}\n${verseHtmlToPlainText(textHtml)}`)
    if (ok) toast('コピーしました')
    else toast.error('コピーできませんでした')
  }

  return (
    // 章を読みながらコメントを見るための非モーダル。バックドロップを出さず
    // ページのスクロールも止めない。外側プレスでの自動クローズは、章のスクロール
    // 操作（外側で 10px 動いた時点）で閉じてしまうため切り、代わりに
    // スワイプと閉じるボタンで閉じる
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      side={isMobile ? 'bottom' : 'right'}
      modal={false}
      disablePointerDismissal
    >
      <DrawerContent showOverlay={false}>
        <DrawerHeader>
          <DrawerTitle>{label}</DrawerTitle>
        </DrawerHeader>
        {/* 本文は出さない。開くと章がその節までスクロールして塗るので一覧で読める。
            下シートは章が見える範囲を残す高さで止め、右パネルは章を縦に覆わないので
            パネルの高さいっぱいまで使う（#206） */}
        <DrawerBody
          className={cn(
            'flex flex-col gap-3 px-4 pb-4',
            isMobile ? 'max-h-[50dvh]' : 'min-h-0 flex-1',
          )}
        >
          <div className="flex items-center gap-2">
            {textHtml && (
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onCopy}>
                <Copy size={14} aria-hidden="true" />
                コピー
              </Button>
            )}
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm underline text-primary"
            >
              公式サイトで読む
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          </div>
          {posts.length > 0 && (
            <p className="text-xs font-medium text-muted-foreground">
              この節に関わる投稿 {posts.length}件
            </p>
          )}
          {posts.map((p) => (
            <div
              key={p.id}
              onPointerEnter={() => onHighlight?.(p.scripture_verses ?? null)}
              onPointerLeave={() => onHighlight?.(null)}
              // 触れたままスクロールに移ると pointerleave が来ず cancel だけ発生する
              onPointerCancel={() => onHighlight?.(null)}
              onFocus={() => onHighlight?.(p.scripture_verses ?? null)}
              onBlur={() => onHighlight?.(null)}
            >
              <CompactPostCard post={p} />
            </div>
          ))}
          {posts.length === 0 && (
            <p className="text-sm text-muted-foreground">この節への投稿はまだありません</p>
          )}
          {canCompose && onCompose && (
            <Button
              type="button"
              variant="accent"
              className="w-full"
              onClick={() => onCompose(verse)}
            >
              この節に投稿する
            </Button>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
