import { Bookmark, BookmarkCheck } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useIsBookmarked, useBookmarkStore, type ScriptureLocation } from '@/entities/bookmark'

type Props = {
  loc: ScriptureLocation
}

export function BookmarkButton({ loc }: Props) {
  const bookmarked = useIsBookmarked(loc)
  const toggleBookmark = useBookmarkStore((s) => s.toggleBookmark)

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => toggleBookmark(loc)}
      aria-label={bookmarked ? '栞から削除' : '栞に追加'}
      aria-pressed={bookmarked}
    >
      {bookmarked ? (
        <BookmarkCheck aria-hidden="true" style={{ color: 'var(--lagoon-deep)' }} />
      ) : (
        <Bookmark aria-hidden="true" />
      )}
    </Button>
  )
}
