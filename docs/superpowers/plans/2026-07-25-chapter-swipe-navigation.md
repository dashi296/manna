# 章スワイプナビゲーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** モバイルの章表示画面（`ChapterView`）で右スワイプ=次の章、左スワイプ=前の章に遷移できるようにする。

**Architecture:** `entities/scripture` に前後の章参照を計算する純粋関数 `getAdjacentChapterRef` を追加し、新規 feature スライス `features/swipe-chapter-navigation` にポインタイベントでドラッグを検知して章コンテンツを追従・スナップさせる `SwipeableChapterView` ラッパーを実装する。`$chapter.tsx` の `ChapterView` はこのラッパーで投稿一覧+節一覧を包むだけにする。

**Tech Stack:** React 19 / TanStack Router / TypeScript / Vitest + @testing-library/react。新規外部ライブラリは追加しない（Pointer Events + CSS transform のみ）。

## Global Constraints

- 対象は `ChapterView`（章全体表示）のみ。`VerseView` は対象外
- `mode === 'select'`（節選択モード）では無効化する
- 有効化条件: 既存の `useIsMobile`（`@/shared/hooks/use-mobile`、1024px未満で true）が `true` のときのみ
- 書（book）の境界はまたぐ。前付け文書（`book.isFrontMatter === true`）は移動先として常にスキップする
- コレクション（`bofm`/`dc-testament`/`pgp`/`ot`/`nt`）の境界は越えない
- 移動先が無い方向へのドラッグはコンテンツを追従させない
- しきい値はコンテナ幅の20%、アニメーションは約200ms ease-out
- コメントは原則不要。WHYが自明でない場合のみ1行

---

### Task 1: `getAdjacentChapterRef`（章参照の計算ロジック）

**Files:**
- Create: `apps/pwa/src/entities/scripture/lib/scriptureNavigation.ts`
- Modify: `apps/pwa/src/entities/scripture/index.ts`
- Test: `apps/pwa/tests/entities/scripture/scriptureNavigation.test.ts`

**Interfaces:**
- Produces: `getAdjacentChapterRef(current: ChapterRef, direction: 'next' | 'prev'): ChapterRef | null` と `type ChapterRef = { collection: string; book: string; chapter: number }`。どちらも `@/entities/scripture` からエクスポートされ、Task 2 で使用する。

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/entities/scripture/scriptureNavigation.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest'
import { getAdjacentChapterRef } from '@/entities/scripture'

describe('getAdjacentChapterRef', () => {
  it('同じ書の中で次の章を返す', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: '1-ne', chapter: 5 }, 'next'))
      .toEqual({ collection: 'bofm', book: '1-ne', chapter: 6 })
  })

  it('同じ書の中で前の章を返す', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: '1-ne', chapter: 5 }, 'prev'))
      .toEqual({ collection: 'bofm', book: '1-ne', chapter: 4 })
  })

  it('書の最終章から次の書の1章目へまたぐ', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: '1-ne', chapter: 22 }, 'next'))
      .toEqual({ collection: 'bofm', book: '2-ne', chapter: 1 })
  })

  it('書の1章目から前の書の最終章へまたぐ', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: '2-ne', chapter: 1 }, 'prev'))
      .toEqual({ collection: 'bofm', book: '1-ne', chapter: 22 })
  })

  it('1章のみの書同士でも前後にまたげる（前付け文書ではないため）', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: 'jarom', chapter: 1 }, 'prev'))
      .toEqual({ collection: 'bofm', book: 'enos', chapter: 1 })
    expect(getAdjacentChapterRef({ collection: 'bofm', book: 'enos', chapter: 1 }, 'next'))
      .toEqual({ collection: 'bofm', book: 'jarom', chapter: 1 })
  })

  it('前付け文書は前方スキップの対象になる（js証の次は1-neの1章）', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: 'js', chapter: 1 }, 'next'))
      .toEqual({ collection: 'bofm', book: '1-ne', chapter: 1 })
  })

  it('前付け文書は後方スキップの対象になる（1-neの1章の前は前付け文書を全て飛ばしてnull）', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: '1-ne', chapter: 1 }, 'prev'))
      .toBeNull()
  })

  it('コレクション末尾（moro最終章）の次はnull', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: 'moro', chapter: 10 }, 'next'))
      .toBeNull()
  })

  it('単一書のみのコレクション（dc-testament）では境界を越えられずnull', () => {
    expect(getAdjacentChapterRef({ collection: 'dc-testament', book: 'dc', chapter: 138 }, 'next'))
      .toBeNull()
    expect(getAdjacentChapterRef({ collection: 'dc-testament', book: 'dc', chapter: 1 }, 'prev'))
      .toBeNull()
  })

  it('コレクション先頭（pgpのmoses 1章）の前はnull', () => {
    expect(getAdjacentChapterRef({ collection: 'pgp', book: 'moses', chapter: 1 }, 'prev'))
      .toBeNull()
  })

  it('存在しない書はnullを返す', () => {
    expect(getAdjacentChapterRef({ collection: 'bofm', book: 'unknown', chapter: 1 }, 'next'))
      .toBeNull()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run tests/entities/scripture/scriptureNavigation.test.ts`
Expected: FAIL（`getAdjacentChapterRef` が存在しない、モジュール解決エラー）

- [ ] **Step 3: 最小実装を書く**

`apps/pwa/src/entities/scripture/lib/scriptureNavigation.ts` を新規作成:

```typescript
import { findBook, findCollection } from '@/shared/lib/scriptureUtils'

export type ChapterRef = { collection: string; book: string; chapter: number }

export function getAdjacentChapterRef(
  current: ChapterRef,
  direction: 'next' | 'prev',
): ChapterRef | null {
  const book = findBook(current)
  if (!book) return null

  if (direction === 'next' && current.chapter < book.chapters) {
    return { ...current, chapter: current.chapter + 1 }
  }
  if (direction === 'prev' && current.chapter > 1) {
    return { ...current, chapter: current.chapter - 1 }
  }

  const collection = findCollection(current.collection)
  if (!collection) return null

  const bookIndex = collection.books.findIndex((b) => b.id === current.book)
  if (bookIndex === -1) return null

  const step = direction === 'next' ? 1 : -1
  for (let i = bookIndex + step; i >= 0 && i < collection.books.length; i += step) {
    const candidate = collection.books[i]
    if (candidate.isFrontMatter) continue
    return {
      collection: current.collection,
      book: candidate.id,
      chapter: direction === 'next' ? 1 : candidate.chapters,
    }
  }
  return null
}
```

`apps/pwa/src/entities/scripture/index.ts` に1行追加:

```typescript
export { getAdjacentChapterRef, type ChapterRef } from './lib/scriptureNavigation'
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run tests/entities/scripture/scriptureNavigation.test.ts`
Expected: PASS（全12ケース）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/entities/scripture/lib/scriptureNavigation.ts apps/pwa/src/entities/scripture/index.ts apps/pwa/tests/entities/scripture/scriptureNavigation.test.ts
git commit -m "feat: add getAdjacentChapterRef for chapter navigation across book/front-matter boundaries"
```

---

### Task 2: `useChapterSwipe` フック + `SwipeableChapterView` コンポーネント

**Files:**
- Create: `apps/pwa/src/features/swipe-chapter-navigation/lib/useChapterSwipe.ts`
- Create: `apps/pwa/src/features/swipe-chapter-navigation/ui/SwipeableChapterView.tsx`
- Create: `apps/pwa/src/features/swipe-chapter-navigation/index.ts`
- Test: `apps/pwa/tests/features/swipe-chapter-navigation/SwipeableChapterView.test.tsx`

**Interfaces:**
- Consumes: `getAdjacentChapterRef(current: ChapterRef, direction: 'next' | 'prev'): ChapterRef | null` と `type ChapterRef` from `@/entities/scripture`（Task 1）。`useNavigate` from `@tanstack/react-router`（既存パターン、`src/widgets/post-editor/ui/PostEditor.tsx:53` と同じ使い方）。
- Produces: `SwipeableChapterView({ loc, disabled, children }: { loc: ChapterRef; disabled?: boolean; children: ReactNode })` from `@/features/swipe-chapter-navigation`。Task 3 で使用する。

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/features/swipe-chapter-navigation/SwipeableChapterView.test.tsx` を新規作成:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { SwipeableChapterView } from '@/features/swipe-chapter-navigation'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

function setContainerWidth(container: HTMLElement, width: number) {
  const el = container.firstElementChild as HTMLElement
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width })
  return el
}

// navigate は「スライドアウトしてから遷移する」設計のため setTimeout(200ms) 経由で呼ばれる。
// フェイクタイマーで進めないと drag() 直後の同期アサートでは間に合わない。
function drag(el: HTMLElement, startX: number, endX: number) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: startX })
  fireEvent.pointerMove(el, { pointerId: 1, clientX: endX })
  fireEvent.pointerUp(el, { pointerId: 1, clientX: endX })
  act(() => {
    vi.advanceTimersByTime(200)
  })
}

const loc = { collection: 'bofm', book: '1-ne', chapter: 5 }

describe('SwipeableChapterView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockNavigate.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('しきい値を超える右ドラッグで次の章へnavigateする', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 100, 200) // +100px = 400px の25% > 20%しきい値
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '6' },
    })
  })

  it('しきい値を超える左ドラッグで前の章へnavigateする', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 200, 100) // -100px
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '4' },
    })
  })

  it('しきい値未満のドラッグではnavigateしない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 100, 130) // +30px = 7.5% < 20%
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('disabledのときはドラッグしてもnavigateしない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc} disabled>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 100, 200)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('移動先が無い方向（コレクション先頭）ではnavigateしない', () => {
    const { container } = render(
      <SwipeableChapterView loc={{ collection: 'pgp', book: 'moses', chapter: 1 }}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 200, 100) // 前方向だが移動先なし
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run tests/features/swipe-chapter-navigation/SwipeableChapterView.test.tsx`
Expected: FAIL（モジュール `@/features/swipe-chapter-navigation` が存在しない）

- [ ] **Step 3: 最小実装を書く**

`apps/pwa/src/features/swipe-chapter-navigation/lib/useChapterSwipe.ts` を新規作成:

```typescript
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getAdjacentChapterRef, type ChapterRef } from '@/entities/scripture'

export const SWIPE_COMMIT_RATIO = 0.2
export const SWIPE_ANIMATION_MS = 200

type DragState = {
  pointerId: number
  startX: number
  containerWidth: number
}

export function useChapterSwipe(loc: ChapterRef, disabled: boolean) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const deltaRef = useRef(0)
  const [deltaX, setDeltaX] = useState(0)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    deltaRef.current = 0
    dragRef.current = null
    setDeltaX(0)
    setAnimating(false)
  }, [loc.collection, loc.book, loc.chapter])

  const targetFor = (dx: number) =>
    dx === 0 ? null : getAdjacentChapterRef(loc, dx > 0 ? 'next' : 'prev')

  const applyDelta = (dx: number) => {
    deltaRef.current = dx
    setDeltaX(dx)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || animating) return
    const width = containerRef.current?.clientWidth ?? 0
    if (width === 0) return
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, containerWidth: width }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const rawDelta = e.clientX - drag.startX
    applyDelta(targetFor(rawDelta) ? rawDelta : 0)
  }

  const endDrag = (pointerId: number) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== pointerId) return
    dragRef.current = null

    const current = deltaRef.current
    const target = targetFor(current)
    const threshold = drag.containerWidth * SWIPE_COMMIT_RATIO

    if (target && Math.abs(current) >= threshold) {
      setAnimating(true)
      applyDelta(current > 0 ? drag.containerWidth : -drag.containerWidth)
      window.setTimeout(() => {
        navigate({
          to: '/scriptures/$collection/$book/$chapter',
          params: {
            collection: target.collection,
            book: target.book,
            chapter: String(target.chapter),
          },
        })
      }, SWIPE_ANIMATION_MS)
      return
    }

    setAnimating(true)
    applyDelta(0)
    window.setTimeout(() => setAnimating(false), SWIPE_ANIMATION_MS)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => endDrag(e.pointerId)
  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => endDrag(e.pointerId)

  return {
    containerRef,
    deltaX,
    animating,
    handlers: disabled
      ? undefined
      : { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
```

`apps/pwa/src/features/swipe-chapter-navigation/ui/SwipeableChapterView.tsx` を新規作成:

```tsx
import type { ReactNode } from 'react'
import type { ChapterRef } from '@/entities/scripture'
import { useChapterSwipe, SWIPE_ANIMATION_MS } from '../lib/useChapterSwipe'

type SwipeableChapterViewProps = {
  loc: ChapterRef
  disabled?: boolean
  children: ReactNode
}

export function SwipeableChapterView({ loc, disabled = false, children }: SwipeableChapterViewProps) {
  const { containerRef, deltaX, animating, handlers } = useChapterSwipe(loc, disabled)

  return (
    <div
      ref={containerRef}
      style={{
        transform: `translateX(${deltaX}px)`,
        transition: animating ? `transform ${SWIPE_ANIMATION_MS}ms ease-out` : 'none',
        touchAction: 'pan-y',
      }}
      {...handlers}
    >
      {children}
    </div>
  )
}
```

`apps/pwa/src/features/swipe-chapter-navigation/index.ts` を新規作成:

```typescript
export { SwipeableChapterView } from './ui/SwipeableChapterView'
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run tests/features/swipe-chapter-navigation/SwipeableChapterView.test.tsx`
Expected: PASS（全5ケース）

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/features/swipe-chapter-navigation apps/pwa/tests/features/swipe-chapter-navigation
git commit -m "feat: add SwipeableChapterView for drag-to-navigate chapter gesture"
```

---

### Task 3: `ChapterView` への組み込み

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx:386-615`（`ChapterView` 関数）
- Modify: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes: `SwipeableChapterView` from `@/features/swipe-chapter-navigation`（Task 2）

- [ ] **Step 1: 失敗するテストを書く**

このファイルは既に `@tanstack/react-router` の `useNavigate` を `navigateSpy`（ファイル冒頭 `const navigateSpy = vi.fn()`、68行目）としてモック済み（80行目 `useNavigate: () => navigateSpy`）。`SwipeableChapterView` が使う `useNavigate` もこの同じモックから解決されるため、モック定義自体の変更は不要。既存の `beforeEach`（113行目）も `navigateSpy.mockClear()` を既に行っている。

まず、ファイル冒頭の import 文に `fireEvent` と `act` を追加する。変更前:

```typescript
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
```

変更後:

```typescript
import { render as rtlRender, screen, waitFor, fireEvent, act } from '@testing-library/react'
```

次に、ファイル末尾（489行目、既存の `describe('ChapterPage', ...)` ブロックの閉じ括弧の後）に新しい `describe` を追加する:

```typescript
describe('ChapterView スワイプナビゲーション', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('モバイル幅で右スワイプすると次の章へnavigateする', () => {
    loaderData = { ...baseChapterData, chapter: 1 }
    const { container } = render(<ChapterPage />)
    const swipable = container.querySelector('[style*="touch-action"]') as HTMLElement
    Object.defineProperty(swipable, 'clientWidth', { configurable: true, value: 400 })

    fireEvent.pointerDown(swipable, { pointerId: 1, clientX: 100 })
    fireEvent.pointerMove(swipable, { pointerId: 1, clientX: 200 })
    fireEvent.pointerUp(swipable, { pointerId: 1, clientX: 200 })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(navigateSpy).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '2' },
    })
  })
})
```

このテストは `beforeEach` で `vi.useFakeTimers()` を呼ぶが、`describe` ごとにフックがスコープされるため既存の `describe('ChapterPage', ...)` ブロック内の `userEvent` を使うテストには影響しない。`navigateSpy` は既存テストでも使われている共有スパイだが、各テストの `beforeEach`（113行目）で毎回 `mockClear()` されるため衝突しない。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run tests/pages/scriptures/chapter.test.tsx -t "スワイプ"`
Expected: FAIL（`swipable` が `null` — まだ `SwipeableChapterView` が組み込まれていない）

- [ ] **Step 3: `ChapterView` に組み込む**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の先頭付近の import に追加:

```typescript
import { SwipeableChapterView } from '@/features/swipe-chapter-navigation'
```

`ChapterView` 関数内、`return` 文（585行目付近）を以下のように変更する。変更前:

```tsx
  return (
    <div>
      {mode === 'select' ? selectionHeader : chapterHeader}
      {posts.length > 0 && (
        <div className="border-b" style={{ borderColor: 'var(--line)' }}>
          <p className="px-4 pt-3 pb-1 text-xs font-medium" style={{ color: 'var(--sea-ink-soft)' }}>
            この章への投稿
          </p>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      {verseList}
      {canCompose && (
```

変更後:

```tsx
  return (
    <div>
      {mode === 'select' ? selectionHeader : chapterHeader}
      <SwipeableChapterView loc={loc} disabled={mode === 'select' || !isMobile}>
        {posts.length > 0 && (
          <div className="border-b" style={{ borderColor: 'var(--line)' }}>
            <p className="px-4 pt-3 pb-1 text-xs font-medium" style={{ color: 'var(--sea-ink-soft)' }}>
              この章への投稿
            </p>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
        {verseList}
      </SwipeableChapterView>
      {canCompose && (
```

（`{activeVerseSheet}` を含む残りのJSXと閉じタグはそのまま変更しない。`SwipeableChapterView` の閉じタグを `verseList` の直後、`{canCompose && (` の直前に置く点に注意）

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `npx vitest run tests/pages/scriptures/chapter.test.tsx`
Expected: PASS（新規テスト含め全て）

- [ ] **Step 5: 全体テストスイートを実行して回帰がないことを確認する**

Run: `npx vitest run`
Expected: PASS（既存の全テストが引き続き通る）

- [ ] **Step 6: コミット**

```bash
git add apps/pwa/src/pages/scriptures/\$collection/\$book/\$chapter.tsx apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat: wire SwipeableChapterView into chapter page for swipe navigation"
```

---

## 完了確認

- [ ] `npx vitest run` が全てPASSする
- [ ] `npx tsc --noEmit`（または既存の型チェックコマンド）がエラーなく通る
- [ ] 実機/ブラウザで `/scriptures/bofm/1-ne/5` をモバイル幅で開き、右スワイプで6章、左スワイプで4章に遷移することを目視確認する
