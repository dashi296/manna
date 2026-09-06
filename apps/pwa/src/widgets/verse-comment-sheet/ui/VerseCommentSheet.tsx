import { useEffect, useRef, useState } from 'react'
import { CompactPostCard, type PostWithUser } from '@/entities/post'
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
  posts: PostWithUser[]
  onOpenChange: (open: boolean) => void
  onHighlight?: (verses: number[] | null) => void
}

export function VerseCommentSheet({
  open,
  verse,
  posts,
  onOpenChange,
  onHighlight,
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
          <DrawerTitle>
            📖 {verse}節のコメント {posts.length}件
          </DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-2 px-4 pb-4 max-h-[70vh]">
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
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
