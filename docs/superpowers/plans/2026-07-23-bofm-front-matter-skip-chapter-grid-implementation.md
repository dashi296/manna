# モルモン書 前付け文書の章選択画面スキップ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** モルモン書の前付け文書5書（`bofm-title`/`introduction`/`three`/`eight`/`js`）に限り、「章を選んでください」の章選択グリッド画面を経由せず、書一覧からタップした瞬間に本文（章1）へ直接遷移させる。

**Architecture:** 章選択グリッドページ（`$collection/$book/index.tsx`）のloaderで `book.isFrontMatter` を判定し、trueなら `redirect()` をthrowして本文ページへ飛ばす。本文ページ（`$chapter.tsx` の `ChapterView`）の「戻る」ボタンは、前付け文書の場合のみグリッド画面ではなく書一覧ページへ直接戻すことで、戻るたびに再リダイレクトされるループを防ぐ。

**Tech Stack:** TanStack Router（`redirect()`）、React、Vitest + Testing Library

## Global Constraints

- 対象は `book.isFrontMatter === true` の5書のみ。既存の1章書（エノス書など）の挙動は変更しない — 詳細設計 `docs/superpowers/specs/2026-07-23-bofm-front-matter-skip-chapter-grid-design.md` 参照
- DBスキーマ・`scriptures.json`・節データは変更しない
- コメントは原則不要。WHY が自明でない場合のみ1行（`CLAUDE.md`）

---

### Task 1: 章選択グリッドページで前付け文書をリダイレクトする（TDD）

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/index.tsx`
- Modify: `apps/pwa/tests/helpers/tanstack.tsx`（`routerMock` に `redirect` スタブを追加）
- Test: `apps/pwa/tests/pages/scriptures/book.test.tsx`（新規）

**Interfaces:**
- Consumes: `getBook(collectionId, bookId)` / `getCollection(collectionId)`（既存、`@/entities/scripture`）
- Produces: なし（このページの外部から呼ばれる関数はない。ルートのloader挙動のみ）

- [ ] **Step 1: `routerMock` に `redirect` のスタブを追加する**

`apps/pwa/tests/helpers/tanstack.tsx` の `routerMock` が返すオブジェクトに、`notFound` の直後へ以下を追加する:

```tsx
    redirect: (opts: { to: string; params?: Record<string, string> }) => opts,
```

（このファイルの他のテストは `redirect` を参照していないため、追加は既存テストに影響しない）

- [ ] **Step 2: 失敗するテストを書く**

`apps/pwa/tests/pages/scriptures/book.test.tsx` を作成:

```tsx
import { describe, it, expect, vi } from 'vitest'

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(),
)

describe('BookPage loader', () => {
  it('front matter の書は第1章へリダイレクトする', async () => {
    const mod = await import('@/pages/scriptures/$collection/$book/index')
    const Route = mod.Route as unknown as {
      loader: (ctx: { params: { collection: string; book: string } }) => unknown
    }
    let thrown: unknown
    try {
      Route.loader({ params: { collection: 'bofm', book: 'introduction' } })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toEqual({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: 'introduction', chapter: '1' },
    })
  })

  it('通常の書はリダイレクトせず book/collection を返す', async () => {
    const mod = await import('@/pages/scriptures/$collection/$book/index')
    const Route = mod.Route as unknown as {
      loader: (ctx: { params: { collection: string; book: string } }) => {
        book: { id: string }
        collection: { id: string }
      }
    }
    const result = Route.loader({ params: { collection: 'bofm', book: '1-ne' } })
    expect(result.book.id).toBe('1-ne')
    expect(result.collection.id).toBe('bofm')
  })
})
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa test tests/pages/scriptures/book.test.tsx`
Expected: 1件目が FAIL（現状の実装はリダイレクトせず `{book, collection}` を返すため `thrown` が `undefined` になり期待値と不一致）

- [ ] **Step 4: loaderにリダイレクトを実装する**

`apps/pwa/src/pages/scriptures/$collection/$book/index.tsx` を以下に置き換える:

```tsx
import { createFileRoute, Link, notFound, redirect } from '@tanstack/react-router'
import { getBook, getCollection } from '@/entities/scripture'
import { PageHeader } from '@/shared/ui'

export const Route = createFileRoute('/scriptures/$collection/$book/')({
  loader: ({ params }) => {
    const book = getBook(params.collection, params.book)
    const collection = getCollection(params.collection)
    if (!book || !collection) throw notFound()
    if (book.isFrontMatter) {
      throw redirect({
        to: '/scriptures/$collection/$book/$chapter',
        params: { collection: params.collection, book: params.book, chapter: '1' },
      })
    }
    return { book, collection }
  },
  component: BookPage,
})

function BookPage() {
  const { book, collection } = Route.useLoaderData()
  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1)
  return (
    <div>
      <PageHeader
        title={book.name}
        backTo="/scriptures/$collection"
        backLabel={collection.name}
      />
      <div className="p-4">
        <p className="text-xs mb-3" style={{ color: 'var(--sea-ink-soft)' }}>章を選んでください</p>
        <div className="grid grid-cols-5 gap-2">
          {chapters.map((ch) => (
            <Link
              key={ch}
              to="/scriptures/$collection/$book/$chapter"
              params={{ collection: collection.id, book: book.id, chapter: String(ch) }}
              className="flex items-center justify-center h-12 rounded-xl text-sm font-semibold transition-colors"
              style={{
                border: '1px solid var(--line)',
                color: 'var(--sea-ink)',
                background: 'var(--surface)',
              }}
            >
              {ch}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
```

（`component`/`BookPage` 自体はロジック変更なし。`loader` に `redirect` の分岐を追加しただけ）

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa test tests/pages/scriptures/book.test.tsx`
Expected: `tests 2 passed`

- [ ] **Step 6: pwa の全テストを実行し回帰がないことを確認する**

Run: `pnpm --filter @manna/pwa test`
Expected: 全テスト PASS（既存213件 + 新規2件）

- [ ] **Step 7: コミット**

```bash
git add apps/pwa/src/pages/scriptures/\$collection/\$book/index.tsx apps/pwa/tests/helpers/tanstack.tsx apps/pwa/tests/pages/scriptures/book.test.tsx
git commit -m "feat: redirect BoM front matter documents past the chapter grid"
```

---

### Task 2: 本文ページの「戻る」ボタンを前付け文書では書一覧へ向ける（TDD）

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`
- Test: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes: `getCollection(collectionId)`（既存、`@/entities/scripture`。Task 1 と同じ関数）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の `describe('ChapterPage', ...)` ブロック末尾（最後の `it` の後、閉じ `})` の直前）に追加:

```ts
  it('front matter の章表示では「戻る」ボタンが書一覧（コレクション名）へ遷移する', () => {
    loaderData = {
      ...baseChapterData,
      book: { id: 'introduction', name: '序文', chapters: 1, verses: [9], isFrontMatter: true },
    }
    render(<ChapterPage />)
    expect(screen.getByRole('link', { name: 'モルモン書' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm --filter @manna/pwa test tests/pages/scriptures/chapter.test.tsx`
Expected: FAIL（現状は `backLabel={book.name}` のため、リンクの accessible name が「序文」になり `'モルモン書'` にマッチしない）

- [ ] **Step 3: import に `getCollection` を追加する**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx:4` を変更:

```tsx
import { getBook, getCollection, buildScriptureUrl, getScriptureLabel } from '@/entities/scripture'
```

- [ ] **Step 4: `ChapterView` で `backTo`/`backLabel` を front matter 対応にする**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx:425-432`（`chapterHeader` 定義の直前に1行追加し、`PageHeader` の `backTo`/`backLabel` を変更）:

```tsx
  const collectionName = getCollection(collection)?.name ?? collection

  const chapterHeader = (
    <>
      <PageHeader
        title={getScriptureLabel(loc, book)}
        backTo={book.isFrontMatter ? '/scriptures/$collection' : '/scriptures/$collection/$book'}
        backLabel={book.isFrontMatter ? collectionName : book.name}
        action={headerAction}
      />
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa test tests/pages/scriptures/chapter.test.tsx`
Expected: 全テスト PASS（既存19件 + 新規1件）

- [ ] **Step 6: pwa の全テストを実行し回帰がないことを確認する**

Run: `pnpm --filter @manna/pwa test`
Expected: 全テスト PASS

- [ ] **Step 7: コミット**

```bash
git add apps/pwa/src/pages/scriptures/\$collection/\$book/\$chapter.tsx apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat: send BoM front matter back-navigation to the book list, not the chapter grid"
```

---

## Self-Review メモ

- 設計ドキュメントの2箇所（章選択グリッドのリダイレクト、本文ページの戻るボタン）は Task 1・Task 2 でそれぞれカバーしている
- `VerseView`（節詳細）は設計上変更不要と明記されており、実際に触れていない
- 既存の1章書（エノス書など）への影響がないことは、Task 1 の2件目のテスト（通常書はリダイレクトしない）と、Task 2 で変更する行が `book.isFrontMatter` 分岐の一方にしか触れないことで担保される
