import { Languages } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useBilingualEnabled, useBilingualDisplayStore } from '@/entities/bilingual-display'

export function BilingualToggleButton() {
  const active = useBilingualEnabled()
  const toggle = useBilingualDisplayStore((s) => s.toggle)

  return (
    <Button
      type="button"
      variant={active ? 'accent' : 'ghost'}
      size="icon-sm"
      onClick={toggle}
      aria-label={active ? '日英併記表示をオフにする' : '日英併記表示をオンにする'}
      aria-pressed={active}
    >
      <Languages aria-hidden="true" />
    </Button>
  )
}
