import { Button } from '@/shared/ui/button'
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
      className="fixed left-0 right-0 z-40 flex items-center gap-2 px-4 py-2 border-t"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 56px)',
        background: 'var(--surface)',
        borderColor: 'var(--line)',
      }}
      data-testid="selection-bar"
    >
      <div className="flex-1 min-w-0 text-xs" style={{ color: 'var(--sea-ink)' }}>
        <span className="font-semibold">{selection.length}節選択中:</span>{' '}
        <span style={{ color: 'var(--sea-ink-soft)' }}>{formatSelectionLabel(selection)}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onClear}>
        クリア
      </Button>
      <Button size="sm" onClick={onOpenComposer}>
        投稿
      </Button>
    </div>
  )
}
