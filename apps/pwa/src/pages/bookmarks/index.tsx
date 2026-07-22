import { createFileRoute, Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import {
  useReadingPosition,
  useBookmarks,
  useBookmarkStore,
  type ScriptureLocation,
} from '@/entities/bookmark'
import { getScriptureLabel } from '@/entities/scripture'
import { formatDate } from '@/shared/lib/date'
import { EmptyState, PageHeader } from '@/shared/ui'
import { Button } from '@/shared/ui/button'

export const Route = createFileRoute('/bookmarks/')({
  component: BookmarksPage,
})

function toChapterParams(loc: ScriptureLocation) {
  return { collection: loc.collection, book: loc.book, chapter: String(loc.chapter) }
}

function BookmarksPage() {
  const readingPosition = useReadingPosition()
  const bookmarks = useBookmarks()
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark)

  return (
    <div>
      <PageHeader title="栞" />
      <section className="px-4 pt-4">
        <h2 className="text-xs font-medium mb-2" style={{ color: 'var(--sea-ink-soft)' }}>
          続きを読む
        </h2>
        {readingPosition ? (
          <Link
            to="/scriptures/$collection/$book/$chapter"
            params={toChapterParams(readingPosition)}
            className="flex items-center justify-between px-4 py-3.5 rounded-xl"
            style={{ border: '1px solid var(--line)', color: 'var(--sea-ink)' }}
          >
            <span className="font-medium">{getScriptureLabel(readingPosition)}</span>
            <span style={{ color: 'var(--sea-ink-soft)' }}>›</span>
          </Link>
        ) : (
          <EmptyState>
            聖典を読むとここに続きが表示されます。
            <Link to="/scriptures" className="block mt-2 underline" style={{ color: 'var(--lagoon-deep)' }}>
              聖典を読む
            </Link>
          </EmptyState>
        )}
      </section>
      <section className="px-4 pt-6 pb-8">
        <h2 className="text-xs font-medium mb-2" style={{ color: 'var(--sea-ink-soft)' }}>
          栞一覧
        </h2>
        {bookmarks.length === 0 ? (
          <EmptyState>栞はまだありません。聖典を読んでいるときに 🔖 をタップすると追加されます。</EmptyState>
        ) : (
          <ul className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--line)' }}>
            {bookmarks.map((bookmark, i) => (
              <li
                key={bookmark.id}
                className={i === bookmarks.length - 1 ? '' : 'border-b'}
                style={{ borderColor: 'var(--line)' }}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <Link
                    to="/scriptures/$collection/$book/$chapter"
                    params={toChapterParams(bookmark)}
                    className="flex-1 min-w-0"
                  >
                    <span className="block font-medium truncate" style={{ color: 'var(--sea-ink)' }}>
                      {getScriptureLabel(bookmark)}
                    </span>
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--sea-ink-soft)' }}>
                      {formatDate(bookmark.createdAt)}
                    </span>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="栞を削除"
                    onClick={() => removeBookmark(bookmark.id)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
