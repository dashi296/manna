import { PenLine, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { stickyHeaderClassName, stickyHeaderStyle } from '@/shared/ui'
import { cn } from '@/shared/lib/utils'

type Props = {
  count: number
  onCancel: () => void
  onSubmit: () => void
}

export function SelectionModeHeader({ count, onCancel, onSubmit }: Props) {
  const submitLabel = count === 0 ? '節を選択してから投稿できます' : `${count}節に投稿`
  const titleLabel = count === 0 ? '節を選んでください' : `${count}節選択中`

  return (
    <header className={cn(stickyHeaderClassName, 'px-2 py-2')} style={stickyHeaderStyle}>
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
        variant="accent"
        size="pill"
        onClick={onSubmit}
        disabled={count === 0}
        aria-label={submitLabel}
        className="shrink-0 gap-1"
      >
        <PenLine size={12} aria-hidden="true" />
        <span>投稿 ({count})</span>
      </Button>
    </header>
  )
}
