import { useState, type ReactNode } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { DeletePostSheet } from './DeletePostSheet'

type Props = {
  postId: string
  onEdit: () => void
}

export function PostActionsMenu({ postId, onEdit }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleEdit = () => {
    setMenuOpen(false)
    onEdit()
  }
  const handleDelete = () => {
    setMenuOpen(false)
    setConfirmOpen(true)
  }

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          className="flex items-center justify-center size-8 rounded-full hover:bg-muted transition-colors"
          aria-label="投稿の操作"
          aria-haspopup="menu"
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-40">
          <div className="flex flex-col" role="menu">
            <MenuItem
              icon={<Pencil size={16} aria-hidden="true" />}
              label="編集"
              onClick={handleEdit}
            />
            <MenuItem
              icon={<Trash2 size={16} aria-hidden="true" />}
              label="削除"
              onClick={handleDelete}
              className="text-destructive"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Popover の中に置くと、閉じた瞬間に unmount されてシートごと消える */}
      <DeletePostSheet postId={postId} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </>
  )
}

type MenuItemProps = {
  icon: ReactNode
  label: string
  onClick: () => void
  className?: string
}

function MenuItem({ icon, label, onClick, className }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-sm text-sm hover:bg-muted transition-colors text-left ${className ?? ''}`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
