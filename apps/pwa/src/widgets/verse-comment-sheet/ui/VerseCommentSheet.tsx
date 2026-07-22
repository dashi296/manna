import { CompactPostCard, type PostWithUser } from '@/entities/post'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'

type Props = {
  open: boolean
  verse: number
  selectedUserName: string
  posts: PostWithUser[]
  onOpenChange: (open: boolean) => void
}

export function VerseCommentSheet({
  open,
  verse,
  selectedUserName,
  posts,
  onOpenChange,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        overlayClassName="supports-backdrop-filter:backdrop-blur-none"
      >
        <SheetHeader>
          <SheetTitle>
            📖 節{verse} — {selectedUserName}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-4 max-h-[70vh] overflow-y-auto">
          {posts.map((p) => (
            <CompactPostCard key={p.id} post={p} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
