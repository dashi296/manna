import { Languages } from 'lucide-react'
import { Button } from '@/shared/ui/button'

type Props = {
  active: boolean
  onToggle: () => void
}

export function BilingualToggleButton({ active, onToggle }: Props) {
  return (
    <Button
      type="button"
      variant={active ? 'accent' : 'ghost'}
      size="icon-sm"
      onClick={onToggle}
      aria-label={active ? '日英併記表示をオフにする' : '日英併記表示をオンにする'}
      aria-pressed={active}
    >
      <Languages aria-hidden="true" />
    </Button>
  )
}
