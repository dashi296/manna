import { CompactPostCard, type PostWithUser } from '@/entities/post'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = {
  open: boolean
  verse: number
  posts: PostWithUser[]
  onOpenChange: (open: boolean) => void
}

export function VerseCommentSheet({ open, verse, posts, onOpenChange }: Props) {
  const isMobile = useIsMobile()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        overlayClassName="supports-backdrop-filter:backdrop-blur-none"
      >
        <SheetHeader>
          <SheetTitle>
            📖 {verse}節のコメント {posts.length}件
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
