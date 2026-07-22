# 聖典しおり（栞）機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 聖典の章ページを開くたびに「続きを読む」位置を自動記録し、ユーザーが任意の章に手動で栞を挟める機能を追加する。

**Architecture:** Supabase テーブルを使わず、`zustand` の `persist` ミドルウェアで `localStorage` にクライアントサイドのみで状態を保持する（`entities/bookmark`）。章ページに栞トグルボタン（`features/toggle-bookmark`）を追加し、新設の `/bookmarks` ページで一覧を表示する。ナビゲーションの「投稿する」（`/posts/new`）を「栞」（`/bookmarks`）に差し替え、`/posts/new` ページを削除する。

**Tech Stack:** React 19 / TanStack Start / zustand 5（persist ミドルウェア）/ lucide-react / Vitest + Testing Library

参照仕様書: [`docs/superpowers/specs/2026-07-22-scripture-bookmark-design.md`](../specs/2026-07-22-scripture-bookmark-design.md)
関連 Issue: [#53](https://github.com/dashi296/manna/issues/53)

## Global Constraints

- localStorage キーは `manna:bookmarks:v1`
- 栞は章単位のみ（節単位は対象外）
- 「続きを読む」位置はユーザー全体で1つのみ（コレクションごとに分けない）
- `/bookmarks` ページと栞トグルはログイン不要（未ログインでも利用可能）
- zustand ストアと SSR セーフな読み取りフックは `features/select-verse-view/model/selectedUserStore.ts` の `useMounted` ガードパターンを踏襲する
- FSD のインポート規則を守る: `entities/bookmark` は `shared` のみに依存、`features/toggle-bookmark` は `entities/bookmark` と `shared` に依存、`pages/bookmarks` は `entities`/`features`/`shared` に依存してよい
- コメントは WHY が自明でない場合のみ1行で記載（原則不要）

---

### Task 1: `entities/bookmark` — 状態管理層

**Files:**
- Create: `apps/pwa/src/entities/bookmark/model/bookmarkStore.ts`
- Create: `apps/pwa/src/entities/bookmark/index.ts`
- Test: `apps/pwa/tests/entities/bookmark/bookmarkStore.test.ts`

**Interfaces:**
- Consumes: `useMounted(): boolean`（`@/shared/hooks/use-mounted`、既存）
- Produces:
  - `type ScriptureLocation = { collection: string; book: string; chapter: number }`
  - `type Bookmark = ScriptureLocation & { id: string; createdAt: string }`
  - `useBookmarkStore` — zustand ストアフック。状態 `{ readingPosition: ScriptureLocation | null; bookmarks: Bookmark[] }`、アクション `setReadingPosition(loc: ScriptureLocation): void`、`toggleBookmark(loc: ScriptureLocation): void`、`removeBookmark(id: string): void`
  - `useReadingPosition(): ScriptureLocation | null`
  - `useIsBookmarked(loc: ScriptureLocation): boolean`
  - `useBookmarks(): Bookmark[]`
  - `BOOKMARK_STORAGE_KEY: string`

- [ ] **Step 1: Write the failing test**

Create `apps/pwa/tests/entities/bookmark/bookmarkStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  BOOKMARK_STORAGE_KEY,
  useBookmarkStore,
} from '@/entities/bookmark/model/bookmarkStore'

const LOC_A = { collection: 'bofm', book: '1-ne', chapter: 1 }
const LOC_B = { collection: 'bofm', book: '1-ne', chapter: 2 }

describe('useBookmarkStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useBookmarkStore.setState({ readingPosition: null, bookmarks: [] })
  })

  it('初期値は readingPosition: null, bookmarks: []', () => {
    const { result } = renderHook(() => useBookmarkStore())
    expect(result.current.readingPosition).toBeNull()
    expect(result.current.bookmarks).toEqual([])
  })

  it('setReadingPosition() で続きを読む位置が上書きされる', () => {
    const { result } = renderHook(() => useBookmarkStore())
    act(() => result.current.setReadingPosition(LOC_A))
    expect(result.current.readingPosition).toEqual(LOC_A)
    act(() => result.current.setReadingPosition(LOC_B))
    expect(result.current.readingPosition).toEqual(LOC_B)
  })

  it('toggleBookmark() で栞が先頭に追加される', () => {
    const { result } = renderHook(() => useBookmarkStore())
    act(() => result.current.toggleBookmark(LOC_A))
    act(() => result.current.toggleBookmark(LOC_B))
    expect(result.current.bookmarks).toHaveLength(2)
    expect(result.current.bookmarks[0]).toMatchObject(LOC_B)
    expect(result.current.bookmarks[1]).toMatchObject(LOC_A)
  })

  it('同じ章に toggleBookmark() すると栞が外れる', () => {
    const { result } = renderHook(() => useBookmarkStore())
    act(() => result.current.toggleBookmark(LOC_A))
    expect(result.current.bookmarks).toHaveLength(1)
    act(() => result.current.toggleBookmark(LOC_A))
    expect(result.current.bookmarks).toHaveLength(0)
  })

  it('removeBookmark() で id 指定の栞が削除される', () => {
    const { result } = renderHook(() => useBookmarkStore())
    act(() => result.current.toggleBookmark(LOC_A))
    const id = result.current.bookmarks[0].id
    act(() => result.current.removeBookmark(id))
    expect(result.current.bookmarks).toHaveLength(0)
  })

  it('bookmarks が localStorage に永続化される', () => {
    const { result } = renderHook(() => useBookmarkStore())
    act(() => result.current.toggleBookmark(LOC_A))
    const stored = localStorage.getItem(BOOKMARK_STORAGE_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.bookmarks).toHaveLength(1)
    expect(parsed.state.bookmarks[0]).toMatchObject(LOC_A)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/pwa && npx vitest run tests/entities/bookmark/bookmarkStore.test.ts`
Expected: FAIL — `Cannot find module '@/entities/bookmark/model/bookmarkStore'`

- [ ] **Step 3: Write minimal implementation**

Create `apps/pwa/src/entities/bookmark/model/bookmarkStore.ts`:

```ts
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
```

Create `apps/pwa/src/entities/bookmark/index.ts`:

```ts
export type { ScriptureLocation, Bookmark } from './model/bookmarkStore'
export {
  BOOKMARK_STORAGE_KEY,
  useBookmarkStore,
  useReadingPosition,
  useIsBookmarked,
  useBookmarks,
} from './model/bookmarkStore'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/pwa && npx vitest run tests/entities/bookmark/bookmarkStore.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/entities/bookmark apps/pwa/tests/entities/bookmark
git commit -m "feat: 栞の状態管理ストアを追加 (entities/bookmark)"
```

---

### Task 2: `features/toggle-bookmark` — 栞トグルボタン

**Files:**
- Create: `apps/pwa/src/features/toggle-bookmark/ui/BookmarkButton.tsx`
- Create: `apps/pwa/src/features/toggle-bookmark/index.ts`
- Test: `apps/pwa/tests/features/toggle-bookmark/BookmarkButton.test.tsx`

**Interfaces:**
- Consumes: `useIsBookmarked`, `useBookmarkStore`, `type ScriptureLocation`（Task 1、`@/entities/bookmark`）、`Button`（`@/shared/ui/button`、`variant`/`size` props 既存）
- Produces: `BookmarkButton({ loc: ScriptureLocation }): JSX.Element`（`@/features/toggle-bookmark`）

- [ ] **Step 1: Write the failing test**

Create `apps/pwa/tests/features/toggle-bookmark/BookmarkButton.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookmarkButton } from '@/features/toggle-bookmark'
import { useBookmarkStore } from '@/entities/bookmark'

const LOC = { collection: 'bofm', book: '1-ne', chapter: 1 }

describe('BookmarkButton', () => {
  beforeEach(() => {
    localStorage.clear()
    useBookmarkStore.setState({ readingPosition: null, bookmarks: [] })
  })

  it('未栞状態では「栞に追加」ボタンを表示する', () => {
    render(<BookmarkButton loc={LOC} />)
    expect(screen.getByRole('button', { name: '栞に追加' })).toBeInTheDocument()
  })

  it('クリックすると栞済みになり「栞から削除」に切り替わる', async () => {
    const user = userEvent.setup()
    render(<BookmarkButton loc={LOC} />)
    await user.click(screen.getByRole('button', { name: '栞に追加' }))
    expect(await screen.findByRole('button', { name: '栞から削除' })).toBeInTheDocument()
    expect(useBookmarkStore.getState().bookmarks).toHaveLength(1)
  })

  it('栞済み状態でクリックすると解除される', async () => {
    useBookmarkStore.setState({
      bookmarks: [{ ...LOC, id: 'b1', createdAt: '2026-07-01T00:00:00.000Z' }],
    })
    const user = userEvent.setup()
    render(<BookmarkButton loc={LOC} />)
    await user.click(screen.getByRole('button', { name: '栞から削除' }))
    expect(await screen.findByRole('button', { name: '栞に追加' })).toBeInTheDocument()
    expect(useBookmarkStore.getState().bookmarks).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/pwa && npx vitest run tests/features/toggle-bookmark/BookmarkButton.test.tsx`
Expected: FAIL — `Cannot find module '@/features/toggle-bookmark'`

- [ ] **Step 3: Write minimal implementation**

Create `apps/pwa/src/features/toggle-bookmark/ui/BookmarkButton.tsx`:

```tsx
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
```

Create `apps/pwa/src/features/toggle-bookmark/index.ts`:

```ts
export { BookmarkButton } from './ui/BookmarkButton'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/pwa && npx vitest run tests/features/toggle-bookmark/BookmarkButton.test.tsx`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/features/toggle-bookmark apps/pwa/tests/features/toggle-bookmark
git commit -m "feat: 栞トグルボタンを追加 (features/toggle-bookmark)"
```

---

### Task 3: 章ページへの組み込み

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx:1` (imports), `:209-232` (`ChapterPage`), `:261` (`VerseView` action), `:398-403` (`ChapterView` headerAction)
- Modify test: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes: `useBookmarkStore`（Task 1）、`BookmarkButton`（Task 2）

- [ ] **Step 1: Write the failing tests**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の `beforeEach` に栞ストアのリセットを追加する（`:82-89` を置き換え）:

```tsx
  beforeEach(async () => {
    loaderData = baseChapterData
    search = { select: [1, 2] }
    navigateSpy.mockClear()
    localStorage.clear()
    const { useSelectedUserStore } = await import('@/features/select-verse-view')
    useSelectedUserStore.setState({ selectedUserId: null })
    const { useBookmarkStore } = await import('@/entities/bookmark')
    useBookmarkStore.setState({ readingPosition: null, bookmarks: [] })
  })
```

同じ `describe('ChapterPage', ...)` ブロック内の末尾（280行目、最後の `})` の直前）に以下を追加する:

```tsx
  it('章ページを開くと続きを読む位置が記録される', async () => {
    const { useBookmarkStore } = await import('@/entities/bookmark')
    render(<ChapterPage />)
    expect(useBookmarkStore.getState().readingPosition).toEqual({
      collection: 'bofm',
      book: '1-ne',
      chapter: 1,
    })
  })

  it('栞ボタンをクリックすると栞が追加される', async () => {
    const { useBookmarkStore } = await import('@/entities/bookmark')
    const user = userEvent.setup()
    render(<ChapterPage />)
    await user.click(screen.getByRole('button', { name: '栞に追加' }))
    expect(useBookmarkStore.getState().bookmarks).toHaveLength(1)
    expect(useBookmarkStore.getState().bookmarks[0]).toMatchObject({
      collection: 'bofm',
      book: '1-ne',
      chapter: 1,
    })
  })

  it('未ログインでも栞ボタンは表示される', () => {
    loaderData = { ...baseChapterData, userId: null }
    render(<ChapterPage />)
    expect(screen.getByRole('button', { name: '栞に追加' })).toBeInTheDocument()
  })

  it('節表示でも栞ボタンは表示される', () => {
    loaderData = { ...baseChapterData, mode: 'verse', verses: [1] }
    render(<ChapterPage />)
    expect(screen.getByRole('button', { name: '栞に追加' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/pwa && npx vitest run tests/pages/scriptures/chapter.test.tsx`
Expected: FAIL — `栞に追加` という名前のボタンが見つからない（`getByRole` が要素なしでエラー）

- [ ] **Step 3: Write minimal implementation**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx:1` を変更:

```ts
import { useEffect, useMemo, useState } from 'react'
```

`:26` の直後（`import type { AvatarStackItem } from '@/shared/ui'` の次の行）に追加:

```ts
import { useBookmarkStore, type ScriptureLocation } from '@/entities/bookmark'
import { BookmarkButton } from '@/features/toggle-bookmark'
```

`:209-232` の `ChapterPage` を置き換え:

```tsx
function ChapterPage() {
  const data = Route.useLoaderData()
  const setReadingPosition = useBookmarkStore((s) => s.setReadingPosition)
  const loc: ScriptureLocation = {
    collection: data.collection,
    book: data.book.id,
    chapter: data.chapter,
  }

  useEffect(() => {
    setReadingPosition(loc)
    // loc は毎レンダーで新規オブジェクトになるため、プリミティブな依存項目で判定する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.collection, loc.book, loc.chapter, setReadingPosition])

  if (data.mode === 'verse') {
    return <VerseView
      book={data.book}
      chapter={data.chapter}
      collection={data.collection}
      verses={data.verses}
      posts={data.posts}
      verseTexts={data.verseTexts}
      canCompose={Boolean(data.userId)}
    />
  }
  return <ChapterView
    book={data.book}
    chapter={data.chapter}
    collection={data.collection}
    posts={data.posts}
    verseTexts={data.verseTexts}
    canCompose={Boolean(data.userId)}
    chapterCommenters={data.chapterCommenters}
    circlePosts={data.circlePosts}
  />
}
```

`:261`（`VerseView` の `PageHeader` の `action` prop）を置き換え:

```tsx
        action={
          <div className="flex items-center gap-2">
            {canCompose && <ComposeButton onClick={() => setSheetOpen(true)} label="投稿する" />}
            <BookmarkButton loc={{ collection, book: book.id, chapter }} />
          </div>
        }
```

`:398-403`（`ChapterView` の `headerAction`）を置き換え:

```tsx
  const headerAction = (
    <div className="flex items-center gap-2">
      {canCompose && (
        <ComposeMenu
          onSelectChapter={openComposerForChapter}
          onSelectVerses={enterSelectMode}
        />
      )}
      <BookmarkButton loc={{ collection, book: book.id, chapter }} />
    </div>
  )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/pwa && npx vitest run tests/pages/scriptures/chapter.test.tsx`
Expected: PASS（全ケース）

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/pages/scriptures apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat: 章ページに栞ボタンと続きを読む位置の自動記録を追加"
```

---

### Task 4: `pages/bookmarks` — 栞ページ

**Files:**
- Create: `apps/pwa/src/pages/bookmarks/index.tsx`
- Test: `apps/pwa/tests/pages/bookmarks/index.test.tsx`

**Interfaces:**
- Consumes: `useReadingPosition`, `useBookmarks`, `useBookmarkStore`, `type Bookmark`（Task 1、`@/entities/bookmark`）、`getScriptureLabel`（`@/entities/scripture`、既存）、`formatDate`（`@/shared/lib/date`、既存）、`EmptyState`/`PageHeader`（`@/shared/ui`、既存）

- [ ] **Step 1: Write the failing test**

Create `apps/pwa/tests/pages/bookmarks/index.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { routeComponent } from '../../helpers/tanstack'

vi.mock('@tanstack/react-router', async () => {
  const { routerMock } = await import('../../helpers/tanstack')
  return routerMock()
})

let BookmarksPage: React.ComponentType

beforeAll(async () => {
  const mod = await import('@/pages/bookmarks/index')
  BookmarksPage = routeComponent(mod)
})

describe('BookmarksPage', () => {
  beforeEach(async () => {
    localStorage.clear()
    const { useBookmarkStore } = await import('@/entities/bookmark')
    useBookmarkStore.setState({ readingPosition: null, bookmarks: [] })
  })

  it('続きを読む位置がなければ空状態を表示する', () => {
    render(<BookmarksPage />)
    expect(screen.getByText('聖典を読むとここに続きが表示されます。')).toBeInTheDocument()
  })

  it('続きを読む位置があればカードを表示する', async () => {
    const { useBookmarkStore } = await import('@/entities/bookmark')
    useBookmarkStore.setState({
      readingPosition: { collection: 'bofm', book: '1-ne', chapter: 3 },
    })
    render(<BookmarksPage />)
    expect(screen.getByText('第1ニーファイ書 第3章')).toBeInTheDocument()
  })

  it('栞がなければ空状態を表示する', () => {
    render(<BookmarksPage />)
    expect(
      screen.getByText('栞はまだありません。聖典を読んでいるときに 🔖 をタップすると追加されます。'),
    ).toBeInTheDocument()
  })

  it('栞一覧を新しい順に表示する', async () => {
    const { useBookmarkStore } = await import('@/entities/bookmark')
    useBookmarkStore.setState({
      bookmarks: [
        { id: 'b2', collection: 'bofm', book: '1-ne', chapter: 2, createdAt: '2026-07-02T00:00:00.000Z' },
        { id: 'b1', collection: 'bofm', book: '1-ne', chapter: 1, createdAt: '2026-07-01T00:00:00.000Z' },
      ],
    })
    render(<BookmarksPage />)
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('第1ニーファイ書 第2章')
    expect(items[1]).toHaveTextContent('第1ニーファイ書 第1章')
  })

  it('削除ボタンで栞が消える', async () => {
    const { useBookmarkStore } = await import('@/entities/bookmark')
    useBookmarkStore.setState({
      bookmarks: [
        { id: 'b1', collection: 'bofm', book: '1-ne', chapter: 1, createdAt: '2026-07-01T00:00:00.000Z' },
      ],
    })
    const user = userEvent.setup()
    render(<BookmarksPage />)
    await user.click(screen.getByRole('button', { name: '栞を削除' }))
    expect(useBookmarkStore.getState().bookmarks).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/pwa && npx vitest run tests/pages/bookmarks/index.test.tsx`
Expected: FAIL — `Cannot find module '@/pages/bookmarks/index'`

- [ ] **Step 3: Write minimal implementation**

Create `apps/pwa/src/pages/bookmarks/index.tsx`:

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/pwa && npx vitest run tests/pages/bookmarks/index.test.tsx`
Expected: PASS（5 tests）

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/pages/bookmarks apps/pwa/tests/pages/bookmarks
git commit -m "feat: 栞一覧・続きを読むページを追加 (pages/bookmarks)"
```

---

### Task 5: ナビゲーション差し替え・`posts/new` 削除・ルート再生成

**Files:**
- Modify: `apps/pwa/src/shared/config/navigation.ts`
- Modify: `apps/pwa/src/pages/__root.tsx:16`
- Delete: `apps/pwa/src/pages/posts/new.tsx`
- Regenerate: `apps/pwa/src/routeTree.gen.ts`（手動編集しない、ビルドで自動生成）

**Interfaces:**
- Consumes: なし（設定変更のみ）

このタスクは既存の自動テストが `navigation.ts`／`__root.tsx`／`posts/new.tsx` を直接カバーしていないため、TDD のステップではなく変更 → ビルド確認 → コミットの順で進める。

- [ ] **Step 1: ナビゲーション項目を差し替える**

`apps/pwa/src/shared/config/navigation.ts` の内容を以下に置き換える:

```ts
import type { LinkProps } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Bell, Bookmark, BookOpen, Home, User } from 'lucide-react'

type NavItem = {
  to: LinkProps['to'] & string
  label: string
  shortLabel?: string
  Icon: LucideIcon
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'フィード', Icon: Home },
  { to: '/scriptures', label: '聖典', Icon: BookOpen },
  { to: '/bookmarks', label: '栞', Icon: Bookmark },
  { to: '/notifications', label: '通知', Icon: Bell },
  { to: '/profile', label: 'プロフィール', Icon: User },
]

export function isNavItemActive(to: string, pathname: string): boolean {
  return pathname === to || (to !== '/' && pathname.startsWith(to))
}
```

- [ ] **Step 2: 認証必須パスから `/posts/new` を外す**

`apps/pwa/src/pages/__root.tsx:16` を変更:

```ts
const AUTH_REQUIRED_PREFIXES = ['/profile', '/notifications']
```

- [ ] **Step 3: `posts/new` ページを削除する**

```bash
git rm apps/pwa/src/pages/posts/new.tsx
```

`widgets/post-editor` は `widgets/post-composer-sheet` からも使われているため削除しないこと（削除しないファイルなので追加操作は不要）。

- [ ] **Step 4: ルートツリーを再生成する**

Run: `pnpm --filter @manna/pwa build`
Expected: ビルドが成功し、`apps/pwa/src/routeTree.gen.ts` が更新される（`/posts/new` の定義が消え、`/bookmarks/` の定義が追加される）。差分を確認する:

```bash
git diff apps/pwa/src/routeTree.gen.ts
```

Expected: `PostsNewRoute` 関連の行が削除され、`BookmarksIndexRoute`（または同等の名前）関連の行が追加されている。

- [ ] **Step 5: 全テストを実行する**

Run: `pnpm --filter @manna/pwa test`
Expected: 全テスト PASS（`posts/new` を参照するテストは存在しないため、削除による失敗はないはず）

- [ ] **Step 6: Commit**

```bash
git add apps/pwa/src/shared/config/navigation.ts apps/pwa/src/pages/__root.tsx apps/pwa/src/routeTree.gen.ts
git commit -m "feat: ナビの「投稿する」を「栞」に差し替え、posts/new を削除"
```

---

## Self-Review Notes

- **Spec coverage**: 仕様書の「保存方式」「データモデル」「FSD配置」「章ページへの組み込み」「pages/bookmarks の UI」「ナビゲーション変更」の各節は Task 1〜5 でそれぞれ実装される。「テスト方針」節の4項目（ストア／ボタン／ページ／章ページ統合）も Task 1〜4 のテストで満たしている。
- **Placeholder scan**: 「TBD」「後で実装」等の記述なし。全ステップに実コードを記載済み。
- **Type consistency**: `ScriptureLocation`（Task 1 で定義）を Task 2〜4 で一貫して使用。`useBookmarkStore` のアクション名（`setReadingPosition`/`toggleBookmark`/`removeBookmark`）は全タスクで統一。
- **削除対象の裏取り**: `/posts/new` への参照は `navigation.ts`／`__root.tsx`／`posts/new.tsx` 自身のみであることを事前調査済み（他ページ・他テストからの依存なし）。
