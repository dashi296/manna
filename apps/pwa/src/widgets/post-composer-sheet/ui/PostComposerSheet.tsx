import { useEffect, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { PostEditor } from '@/widgets/post-editor'
import { type ScriptureRefPartial } from '@/features/select-scripture'
import { getScriptureLabel } from '@/entities/scripture'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialScripture?: ScriptureRefPartial
}

const HISTORY_STATE_MARKER = { mannaComposer: true }

export function PostComposerSheet({ open, onOpenChange, initialScripture }: Props) {
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  useEffect(() => {
    if (!open) return
    window.history.pushState(HISTORY_STATE_MARKER, '')
    const handler = () => onOpenChangeRef.current(false)
    window.addEventListener('popstate', handler)
    return () => {
      window.removeEventListener('popstate', handler)
      if (window.history.state && (window.history.state as { mannaComposer?: boolean }).mannaComposer) {
        window.history.back()
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
        side="bottom"
        className="max-h-[92dvh] h-[70dvh] flex flex-col gap-0 rounded-t-2xl"
      >
        <SheetHeader className="border-b" style={{ borderColor: 'var(--line)' }}>
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
