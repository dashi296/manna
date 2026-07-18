import { useEffect, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { PostEditor } from '@/widgets/post-editor'
import { type ScriptureRefPartial } from '@/features/select-scripture'
import { getScriptureLabel } from '@/entities/scripture'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialScripture?: ScriptureRefPartial
  /**
   * シートの close 動作 (history.back による composer 用エントリ pop) が
   * 完了した後に呼ばれる。onOpenChange とは別に必要。呼び出し側は
   * これを待って select モード解除などの後処理を行う。
   */
  onClosed?: () => void
}

type ComposerHistoryState = { mannaComposer: true }
const HISTORY_STATE_MARKER: ComposerHistoryState = { mannaComposer: true }

export function PostComposerSheet({ open, onOpenChange, initialScripture, onClosed }: Props) {
  const isMobile = useIsMobile()
  const onOpenChangeRef = useRef(onOpenChange)
  const onClosedRef = useRef(onClosed)
  onOpenChangeRef.current = onOpenChange
  onClosedRef.current = onClosed

  useEffect(() => {
    if (!open) return
    window.history.pushState(HISTORY_STATE_MARKER, '')
    const handler = () => onOpenChangeRef.current(false)
    window.addEventListener('popstate', handler)
    return () => {
      window.removeEventListener('popstate', handler)
      const hasMarker = (window.history.state as ComposerHistoryState | null)?.mannaComposer
      if (hasMarker) {
        // プログラム経由の close: composer エントリを pop してから onClosed。
        window.addEventListener(
          'popstate',
          () => onClosedRef.current?.(),
          { once: true },
        )
        window.history.back()
      } else {
        // ブラウザバック経由の close: 既に pop 済みなので即 onClosed。
        onClosedRef.current?.()
      }
    }
  }, [open])

  const title = initialScripture?.collection && initialScripture.book
    ? `📖 ${getScriptureLabel({
        collection: initialScripture.collection,
        book: initialScripture.book,
        chapter: initialScripture.chapter,
        verses: initialScripture.verses,
      })}`
    : '新しい投稿'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={
          isMobile
            ? 'max-h-[92dvh] h-[70dvh] flex flex-col gap-0 rounded-t-2xl'
            : 'h-dvh w-[min(520px,40vw)] max-w-none flex flex-col gap-0 rounded-none'
        }
      >
        <SheetHeader bordered>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <PostEditor
            initialScripture={initialScripture}
            mode="sheet"
            onSuccess={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
