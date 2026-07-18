import { Button } from '@/shared/ui/button'
import { PenLine, X } from 'lucide-react'
import { formatSelectionLabel } from '../model/useVerseSelection'

type Props = {
  selection: number[]
  onClear: () => void
  onOpenComposer: () => void
}

export function SelectionBar({ selection, onClear, onOpenComposer }: Props) {
  if (selection.length === 0) return null

  return (
    <div
      className="fixed left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-40 flex items-center gap-2 px-4 py-2 border-t lg:left-auto lg:right-6 lg:bottom-6 lg:w-44 lg:gap-2 lg:rounded-full lg:border lg:p-2 lg:shadow-md"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--line)',
      }}
      data-testid="selection-bar"
    >
      <div
        className="hidden h-7 items-center justify-center text-xs font-semibold lg:flex lg:w-10 lg:rounded-full"
        style={{
          background: 'var(--sea-soft)',
          color: 'var(--sea-ink)',
        }}
        data-testid="selection-count-pill"
      >
        {selection.length}節
      </div>
      <div
        className="flex-1 min-w-0 text-xs lg:sr-only"
        style={{ color: 'var(--sea-ink)' }}
        data-testid="selection-label"
      >
        <span className="font-semibold">{selection.length}節選択中:</span>{' '}
        <span style={{ color: 'var(--sea-ink-soft)' }}>{formatSelectionLabel(selection)}</span>
      </div>
      <div className="contents lg:flex lg:gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 lg:size-7 lg:px-0"
          aria-label="選択をクリア"
          onClick={onClear}
        >
          <X className="hidden size-3.5 lg:block" aria-hidden="true" />
          <span className="lg:sr-only">クリア</span>
        </Button>
        <Button
          size="sm"
          className="shrink-0 lg:h-7 lg:flex-1 lg:gap-1 lg:px-2 lg:text-xs"
          aria-label="選択した節を投稿"
          onClick={onOpenComposer}
        >
          <PenLine className="hidden size-3.5 lg:block" aria-hidden="true" />
          <span>投稿</span>
        </Button>
      </div>
    </div>
  )
}
