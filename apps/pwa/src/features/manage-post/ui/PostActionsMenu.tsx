import { useState, type ReactNode } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/shared/ui/menu'
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
      <Menu open={menuOpen} onOpenChange={setMenuOpen}>
        <MenuTrigger
          className="flex items-center justify-center size-8 rounded-full hover:bg-muted transition-colors"
          aria-label="投稿の操作"
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </MenuTrigger>
        <MenuContent align="end">
          <ActionItem
            icon={<Pencil size={16} aria-hidden="true" />}
            label="編集"
            onClick={handleEdit}
          />
          <ActionItem
            icon={<Trash2 size={16} aria-hidden="true" />}
            label="削除"
            onClick={handleDelete}
            className="text-destructive"
          />
        </MenuContent>
      </Menu>

      {/* Menu の中に置くと、閉じた瞬間に unmount されてシートごと消える */}
      <DeletePostSheet postId={postId} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </>
  )
}

type ActionItemProps = {
  icon: ReactNode
  label: string
  onClick: () => void
  className?: string
}

function ActionItem({ icon, label, onClick, className }: ActionItemProps) {
  return (
    <MenuItem onClick={onClick} className={className}>
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </MenuItem>
  )
}
