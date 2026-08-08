import { useState, type ReactNode } from 'react'
import { BookOpen, PenLine } from 'lucide-react'
import { ComposePostButton } from '@/shared/ui/ComposePostButton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = {
  onSelectChapter: () => void
  onSelectVerses: () => void
  layout?: 'pill' | 'fab'
}

export function ComposeMenu({ onSelectChapter, onSelectVerses, layout = 'pill' }: Props) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  const handleChapter = () => {
    setOpen(false)
    onSelectChapter()
  }
  const handleVerses = () => {
    setOpen(false)
    onSelectVerses()
  }

  const menuItems = (
    <div className="flex flex-col" role="menu">
      <MenuItem
        icon={<BookOpen size={18} aria-hidden="true" />}
        label="章全体に投稿"
        description="この章全体への感想を書く"
        onClick={handleChapter}
      />
      <MenuItem
        icon={<PenLine size={18} aria-hidden="true" />}
        label="節を選んで投稿"
        description="複数の節にまたがる投稿を書く"
        onClick={handleVerses}
      />
    </div>
  )

  if (isMobile || layout === 'fab') {
    return (
      <>
        <ComposePostButton
          layout={layout}
          label="投稿する"
          onClick={() => setOpen(true)}
          aria-haspopup="menu"
          aria-expanded={open}
        />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl gap-0 pb-6 max-h-[50dvh]"
            showCloseButton={false}
          >
            <SheetHeader bordered>
              <SheetTitle>投稿する</SheetTitle>
            </SheetHeader>
            {menuItems}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<ComposePostButton label="投稿する" aria-haspopup="menu" />}
      />
      <PopoverContent align="end" className="w-64">
        {menuItems}
      </PopoverContent>
    </Popover>
  )
}

type MenuItemProps = {
  icon: ReactNode
  label: string
  description: string
  onClick: () => void
}

function MenuItem({ icon, label, description, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
    >
      <span className="shrink-0 mt-0.5" style={{ color: 'var(--lagoon-deep)' }}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold" style={{ color: 'var(--sea-ink)' }}>
          {label}
        </span>
        <span className="block text-xs mt-0.5" style={{ color: 'var(--sea-ink-soft)' }}>
          {description}
        </span>
      </span>
    </button>
  )
}
