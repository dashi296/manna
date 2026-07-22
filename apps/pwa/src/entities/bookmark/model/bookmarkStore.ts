import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ScriptureLocation = {
  collection: string
  book: string
  chapter: number
}

export type Bookmark = ScriptureLocation & {
  id: string
  createdAt: string
}

export const BOOKMARK_STORAGE_KEY = 'manna:bookmarks:v1'

type State = {
  readingPosition: ScriptureLocation | null
  bookmarks: Bookmark[]
  setReadingPosition: (loc: ScriptureLocation) => void
  toggleBookmark: (loc: ScriptureLocation) => void
  removeBookmark: (id: string) => void
}

function sameLocation(a: ScriptureLocation, b: ScriptureLocation): boolean {
  return a.collection === b.collection && a.book === b.book && a.chapter === b.chapter
}

export const useBookmarkStore = create<State>()(
  persist(
    (set, get) => ({
      readingPosition: null,
      bookmarks: [],
      setReadingPosition: (loc) => set({ readingPosition: loc }),
      toggleBookmark: (loc) => {
        const existing = get().bookmarks.find((b) => sameLocation(b, loc))
        if (existing) {
          set({ bookmarks: get().bookmarks.filter((b) => b.id !== existing.id) })
          return
        }
        const bookmark: Bookmark = {
          ...loc,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }
        set({ bookmarks: [bookmark, ...get().bookmarks] })
      },
      removeBookmark: (id) =>
        set({ bookmarks: get().bookmarks.filter((b) => b.id !== id) }),
    }),
    { name: BOOKMARK_STORAGE_KEY },
  ),
)

// SSR-safe readers: SSR と初回クライアントレンダーは persist 未反映の初期値
// (null/[]) で一致させ、mount 後に永続化された値へ切り替える
// (useSelectedUserId と同じパターン)。
import { useMounted } from '@/shared/hooks/use-mounted'

export function useReadingPosition(): ScriptureLocation | null {
  const position = useBookmarkStore((s) => s.readingPosition)
  const mounted = useMounted()
  return mounted ? position : null
}

export function useIsBookmarked(loc: ScriptureLocation): boolean {
  const bookmarks = useBookmarkStore((s) => s.bookmarks)
  const mounted = useMounted()
  return mounted && bookmarks.some((b) => sameLocation(b, loc))
}

export function useBookmarks(): Bookmark[] {
  const bookmarks = useBookmarkStore((s) => s.bookmarks)
  const mounted = useMounted()
  return mounted ? bookmarks : []
}
