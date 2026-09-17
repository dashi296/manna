import { useEffect, useRef, useState } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { CompactPostCard, type PostWithUser } from '@/entities/post'
import { verseHtmlToPlainText } from '@/entities/scripture'
import { copyText } from '@/shared/lib/clipboard'
import { SanitizedVerseHtml } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { toast } from '@/shared/ui/sonner'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/ui/drawer'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = {
  open: boolean
  verse: number
  label: string
  officialUrl: string
  textHtml?: string
  textHtmlSecondary?: string
  secondaryLang?: string
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
  textHtmlSecondary,
  secondaryLang,
  posts,
  onOpenChange,
  onHighlight,
  canCompose = false,
  onCompose,
}: Props) {
  const isMobile = useIsMobile()
  // useIsMobile は画面幅を effect でしか反映しないため、初回描画は必ず false になる。
  // そのまま描画するとモバイルでも一度 side="right" で DOM に入り、右からのスライド
  // アニメーションが始まってから下シートへ切り替わる
  const [widthResolved, setWidthResolved] = useState(false)
  useEffect(() => setWidthResolved(true), [])

  // アンマウント時に塗りが残らないようにする。onHighlight は毎描画で作り直される
  // ことがあるため、ref 経由で読んでクリーンアップの再実行を避ける
  const highlightRef = useRef(onHighlight)
  highlightRef.current = onHighlight
  useEffect(() => () => highlightRef.current?.(null), [])

  if (!widthResolved) return null

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
        <DrawerBody className="flex flex-col gap-3 px-4 pb-4 max-h-[70vh]">
          <div className="flex flex-col gap-2">
            {textHtml && (
              <div className="text-sm">
                <SanitizedVerseHtml className="text-foreground" html={textHtml} />
                {textHtmlSecondary && (
                  <SanitizedVerseHtml
                    html={textHtmlSecondary}
                    className="block mt-1 text-muted-foreground"
                    lang={secondaryLang}
                  />
                )}
              </div>
            )}
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
                className="inline-flex items-center gap-1 text-sm underline"
                style={{ color: 'var(--lagoon-deep)' }}
              >
                公式サイトで読む
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
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
            <p className="text-sm text-muted-foreground">
              この節への投稿はまだありません
            </p>
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
