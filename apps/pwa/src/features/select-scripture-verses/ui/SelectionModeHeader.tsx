import { PenLine, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'

type Props = {
  count: number
  onCancel: () => void
  onSubmit: () => void
}

export function SelectionModeHeader({ count, onCancel, onSubmit }: Props) {
  const submitLabel = count === 0 ? '節を選択してから投稿できます' : `${count}節に投稿`
  const titleLabel = count === 0 ? '節を選んでください' : `${count}節選択中`

  return (
    <header
      className="sticky top-0 z-10 px-2 py-2 flex items-center gap-2"
      style={{
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--line)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        aria-label="選択をキャンセル"
        className="shrink-0 gap-1"
      >
        <X size={16} aria-hidden="true" />
        <span className="text-sm">キャンセル</span>
      </Button>
      <h1
        className="flex-1 text-center text-sm font-semibold truncate"
        style={{ color: 'var(--sea-ink)' }}
      >
        {titleLabel}
      </h1>
      <Button
        size="sm"
        onClick={onSubmit}
        disabled={count === 0}
        aria-label={submitLabel}
        className="shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold gap-1"
        style={
          count > 0
            ? { background: 'var(--lagoon)', color: '#fff' }
            : undefined
        }
      >
        <PenLine size={12} aria-hidden="true" />
        <span>投稿 ({count})</span>
      </Button>
    </header>
  )
}
