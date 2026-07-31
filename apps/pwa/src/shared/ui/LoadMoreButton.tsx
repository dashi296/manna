import { Button } from '@/shared/ui/button'

export function LoadMoreButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled: boolean
}) {
  return (
    <div className="p-4 text-center">
      <Button onClick={onClick} disabled={disabled} variant="outline" size="sm">
        もっと見る
      </Button>
    </div>
  )
}
