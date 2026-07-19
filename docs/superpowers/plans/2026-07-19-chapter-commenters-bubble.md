# 章コメンタービュー 吹き出し方式 pivot 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR #50 の「デスクトップ右レール + モバイル Sheet」構成を、実機検証・Codex review で判明した問題を解消するため「節ごとの吹き出し (デスクトップ) + モバイル Sheet スクロール対応」構成に pivot する。

**Architecture:** PR #50 の loader (view=who, user, chapterCommenters, selectedUserPosts, versesWithSelectedUser) をそのまま利用。UI レイヤーの変更のみ:
- `entities/post/ui/CommenterBubble.tsx` を新設し、`CompactPostCard` を吹き出しスタイルで包む
- 節リストを `<li className="lg:flex">` 化し、右側に選択ユーザーの吹き出しを縦スタック
- `widgets/chapter-comment-rail/` を丸ごと削除
- `widgets/verse-comment-sheet/` の `SheetContent` に `max-h-[70vh]` + `overflow-y-auto`
- `pages/__root.tsx` の `max-w-md` を、章画面 (`/scriptures/*/*/数字`) だけ `lg:max-w-4xl` に緩和

**Tech Stack:** React 19 + TanStack Start / Vite / TypeScript / Base UI / TailwindCSS v4 / Vitest + @testing-library/react

## Global Constraints

- FSD レイヤー順守: `widgets → features → entities → shared`
- Path prefix `apps/pwa/`
- @/ = `apps/pwa/src/`
- コメントは原則不要
- CSS 変数: `--chip-bg` / `--chip-line` / `--sea-ink-soft` / `--surface` / `--line`
- 元設計との整合: [`2026-07-19-chapter-commenters-view-design.md`](../specs/2026-07-19-chapter-commenters-view-design.md)（吹き出し方式 pivot 後）
- 変更前ブランチ HEAD: `7519d96` (spec pivot commit)
- 既存テストは全 pass を維持

## ファイル構成

**新規:**
- `apps/pwa/src/entities/post/ui/CommenterBubble.tsx` — 吹き出しラッパー（`CompactPostCard` を包む）
- `apps/pwa/tests/entities/post/CommenterBubble.test.tsx`

**改修:**
- `apps/pwa/src/entities/post/index.ts` — `CommenterBubble` を追加 export
- `apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx` — `max-h-[70vh]` + `overflow-y-auto` を追加
- `apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx` — スクロールクラスの検証テスト追加
- `apps/pwa/src/pages/__root.tsx` — 章画面のみ `max-w-md` を `lg:max-w-4xl` に緩和
- `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` — 節リストに吹き出し統合、`ChapterCommentRail` 参照を撤去、`postsByVerse` を desktop 描画に転用
- `apps/pwa/tests/pages/scriptures/chapter.test.tsx` — 既存 rail 見出しテストを吹き出し検出テストに置換、新しい期待に沿ってアップデート

**削除:**
- `apps/pwa/src/widgets/chapter-comment-rail/ui/ChapterCommentRail.tsx`
- `apps/pwa/src/widgets/chapter-comment-rail/index.ts`
- `apps/pwa/tests/widgets/chapter-comment-rail/ChapterCommentRail.test.tsx`

---

## Task 1: `CommenterBubble` 吹き出しコンポーネント

**Files:**
- Create: `apps/pwa/src/entities/post/ui/CommenterBubble.tsx`
- Modify: `apps/pwa/src/entities/post/index.ts`
- Create: `apps/pwa/tests/entities/post/CommenterBubble.test.tsx`

**Interfaces:**
- Consumes: `PostWithUser` from `../model`, `CompactPostCard` from `./CompactPostCard`
- Produces:
  - `<CommenterBubble post />` — 選択ユーザー投稿を吹き出しラッパーで囲む

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/entities/post/CommenterBubble.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { CommenterBubble } from '@/entities/post'
import type { PostWithUser } from '@/entities/post'

const post: PostWithUser = {
  id: 'post-1',
  content: '節の吹き出しテスト',
  visibility: 'public',
  created_at: '2026-07-19T00:00:00.000Z',
  scripture_collection: 'bofm',
  scripture_book: '1-ne',
  scripture_chapter: 3,
  scripture_verses: [7],
  user_id: 'u1',
  users: { display_name: '中村さん', avatar_url: null },
}

function renderInRouter(ui: React.ReactNode) {
  const root = createRootRoute({ component: () => <Outlet />, notFoundComponent: () => null })
  const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <>{ui}</> })
  const postRoute = createRoute({
    getParentRoute: () => root,
    path: '/posts/$id',
    component: () => <div>post</div>,
  })
  const router = createRouter({
    routeTree: root.addChildren([index, postRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

describe('CommenterBubble', () => {
  it('CompactPostCard の本文を描画する', async () => {
    renderInRouter(<CommenterBubble post={post} />)
    await waitFor(() => {
      expect(screen.getByText('節の吹き出しテスト')).toBeInTheDocument()
    })
  })

  it('吹き出しラッパー div に role="group" + aria-label が付く', async () => {
    renderInRouter(<CommenterBubble post={post} />)
    await waitFor(() => {
      expect(
        screen.getByRole('group', { name: /中村さんの吹き出し/ }),
      ).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test CommenterBubble`
Expected: module not found (`CommenterBubble` is not exported)

- [ ] **Step 3: 実装**

`apps/pwa/src/entities/post/ui/CommenterBubble.tsx`:

```typescript
import type { PostWithUser } from '../model'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { CompactPostCard } from './CompactPostCard'

type Props = {
  post: PostWithUser
}

export function CommenterBubble({ post }: Props) {
  const { displayName } = resolveUserIdentity(post.users)
  return (
    <div
      role="group"
      aria-label={`${displayName}の吹き出し`}
      className="relative rounded-lg"
      style={{
        background: 'var(--chip-bg)',
        border: '1px solid var(--chip-line)',
      }}
    >
      <span
        aria-hidden="true"
        className="hidden lg:block absolute left-[-6px] top-4 w-3 h-3 rotate-45"
        style={{
          background: 'var(--chip-bg)',
          borderLeft: '1px solid var(--chip-line)',
          borderBottom: '1px solid var(--chip-line)',
        }}
      />
      <CompactPostCard post={post} />
    </div>
  )
}
```

- [ ] **Step 4: `entities/post/index.ts` に export 追加**

現行の `apps/pwa/src/entities/post/index.ts` を Read し、末尾に:

```typescript
export { CommenterBubble } from './ui/CommenterBubble'
```

- [ ] **Step 5: pass 確認**

Run: `pnpm --filter pwa test CommenterBubble`
Expected: 2 tests passing

- [ ] **Step 6: commit**

```bash
git add apps/pwa/src/entities/post/ui/CommenterBubble.tsx \
        apps/pwa/src/entities/post/index.ts \
        apps/pwa/tests/entities/post/CommenterBubble.test.tsx
git commit -m "feat(entities/post): CommenterBubble 吹き出しコンポーネントを追加"
```

---

## Task 2: `VerseCommentSheet` にスクロール対応追加

**Files:**
- Modify: `apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx`
- Modify: `apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx`

**Interfaces:** 変更なし（既存 Props をそのまま維持）

**Change:** 内側の投稿リスト container に `max-h-[70vh] overflow-y-auto` を追加。多件時にスクロール可能に。

### Steps

- [ ] **Step 1: 既存テストに追加**

`apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx` の describe 末尾に:

```typescript
  it('内側の投稿リスト container に max-h と overflow-y-auto を持つ', async () => {
    const { container } = renderInRouter(
      <VerseCommentSheet
        open={true}
        verse={7}
        selectedUserName="中村さん"
        posts={posts}
        onOpenChange={vi.fn()}
      />,
    )
    await waitFor(() => {
      const scroller = container.ownerDocument.body.querySelector(
        '[data-slot="sheet-content"] .max-h-\\[70vh\\]',
      )
      expect(scroller).not.toBeNull()
      expect(scroller?.className).toContain('overflow-y-auto')
    })
  })
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test VerseCommentSheet`
Expected: 新規テスト失敗（`max-h-[70vh]` class が存在しない）

- [ ] **Step 3: 実装**

`apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx` の内側 `<div>` に class 追加:

```typescript
        <div className="flex flex-col gap-2 px-4 pb-4 max-h-[70vh] overflow-y-auto">
          {posts.map((p) => (
            <CompactPostCard key={p.id} post={p} />
          ))}
        </div>
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test VerseCommentSheet`
Expected: 3 tests passing (既存 2 + 新規 1)

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx \
        apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx
git commit -m "fix(widgets/verse-comment-sheet): 多件時のスクロール対応 (Codex P2)"
```

---

## Task 3: `__root.tsx` で章画面の `max-w-md` を緩和

**Files:**
- Modify: `apps/pwa/src/pages/__root.tsx`

**Interfaces:** 変更なし（外部 API に影響なし）

**Change:** `useRouterState` で現在の pathname を取得し、`/scriptures/[collection]/[book]/[数字]` にマッチするときだけ container class を `max-w-4xl mx-auto` に切り替える。他ページは既存の `max-w-md mx-auto` のまま。

### Steps

- [ ] **Step 1: 現在の `__root.tsx` を Read**

- [ ] **Step 2: 判定ヘルパー + `useRouterState` 呼び出し追加**

`RootLayout` 関数の中で:

```typescript
import { Outlet, useRouterState } from '@tanstack/react-router'

// ...

const CHAPTER_PATH_RE = /^\/scriptures\/[^/]+\/[^/]+\/\d+$/

function RootLayout({ children }: { children: React.ReactNode }) {
  // ... existing state ...
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isChapterPage = CHAPTER_PATH_RE.test(pathname)
  const containerClass = isChapterPage ? 'lg:max-w-4xl mx-auto' : 'max-w-md mx-auto'

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <AppSidebar />
        <SidebarInset className="flex flex-col min-h-screen min-w-0">
          <main className="flex-1 pb-16 lg:pb-0">
            <div className={containerClass}>
              <Outlet />
            </div>
          </main>
          <InstallPwaBanner />
          <BottomNav />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
```

`useRouterState` が現在の `RootLayout` で使えない場合 (import されてない) は追加。既存 import の `@tanstack/react-router` に足す。

- [ ] **Step 3: build & smoke test**

Run: `pnpm --filter pwa build`
Expected: 型エラーなし

Run: `pnpm --filter pwa test`
Expected: 既存全 test pass（この変更で壊れるものはないはず）

- [ ] **Step 4: commit**

```bash
git add apps/pwa/src/pages/__root.tsx
git commit -m "fix(pages/__root): 章画面のみ max-w-md を lg:max-w-4xl に緩和"
```

---

## Task 4: 章画面の吹き出し統合と rail 削除

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`
- Modify: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`
- Delete: `apps/pwa/src/widgets/chapter-comment-rail/ui/ChapterCommentRail.tsx`
- Delete: `apps/pwa/src/widgets/chapter-comment-rail/index.ts`
- Delete: `apps/pwa/tests/widgets/chapter-comment-rail/ChapterCommentRail.test.tsx`

**Interfaces:**
- Consumes: `CommenterBubble` from `@/entities/post` (Task 1)
- Produces: 節リストで desktop 時、選択ユーザーがコメントしている節の右に吹き出しが出る

### Steps

- [ ] **Step 1: chapter test の期待を更新**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の rail 見出しテスト:

```typescript
  it('mode=select 中は選択ユーザーがあっても右レール見出しを描画しない', () => {
```

を吹き出しに合わせて書き換え。まず既存の rail-heading 検出テスト（`中村さんのコメント`）を吹き出し検出に変える。既存の assertion:

```typescript
    expect(
      screen.queryByRole('heading', { name: /中村さんのコメント/ }),
    ).toBeNull()
```

を:

```typescript
    expect(screen.queryByRole('group', { name: /中村さんの吹き出し/ })).toBeNull()
```

に置換。また、既存の「view=who で avatarsByVerse を VerseRow に渡す」テストは吹き出しの存在も検証するように追加:

```typescript
  it('view=who で desktop 相当なら選択ユーザーの吹き出しが節横に描画される', async () => {
    // simulate desktop
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1440 })
    window.dispatchEvent(new Event('resize'))
    loaderData = {
      ...baseChapterData,
      view: 'who',
      selectedUser: { userId: 'u1', name: '中村さん', avatarUrl: null },
      selectedUserPosts: [
        {
          id: 'p1',
          content: '節1 吹き出しテスト',
          visibility: 'public' as const,
          created_at: '2026-07-19T00:00:00.000Z',
          scripture_collection: 'bofm',
          scripture_book: '1-ne',
          scripture_chapter: 1,
          scripture_verses: [1],
          user_id: 'u1',
          users: { display_name: '中村さん', avatar_url: null },
        },
      ],
      versesWithSelectedUser: [1],
    }
    search = { view: 'who', user: 'u1' }
    render(<ChapterPage />)
    await waitFor(() => {
      expect(screen.getByText('節1 吹き出しテスト')).toBeInTheDocument()
      expect(
        screen.getByRole('group', { name: /中村さんの吹き出し/ }),
      ).toBeInTheDocument()
    })
  })
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test chapter`
Expected: 変更した既存テストと新規テストが失敗

- [ ] **Step 3: `chapter.tsx` を更新**

Import 変更:
- Remove: `import { ChapterCommentRail } from '@/widgets/chapter-comment-rail'`
- Add: `import { CommenterBubble } from '@/entities/post'`

`showRail` を削除して `showBubbles` に置換:

```typescript
  const showBubbles = mode !== 'select' && !isMobile && selectedUser !== null
```

`verseList` を吹き出し統合形に書き換え:

```typescript
  const verseList = (
    <div className="p-4 pb-24">
      <ul
        className="overflow-hidden rounded-xl"
        style={{ border: '1px solid var(--line)' }}
      >
        {verseNumbers.map((verse) => {
          const count = countByVerse[verse] ?? 0
          const vt = verseTextMap.get(verse)
          const isSelected = mode === 'select' && selection.includes(verse)
          const marker =
            showMarkers && versesWithMarker.has(verse) && selectedUser
              ? selectedUser
              : undefined
          const bubblePosts = showBubbles ? postsByVerse.get(verse) ?? [] : []
          return (
            <li
              key={verse}
              className="border-b last:border-b-0 lg:flex lg:items-start"
              style={{ borderColor: 'var(--line)' }}
            >
              <div className="lg:flex-1 lg:min-w-0">
                <VerseRow
                  collection={collection}
                  book={book.id}
                  chapter={chapter}
                  verse={verse}
                  textHtml={vt?.text_html}
                  count={count}
                  mode={mode}
                  selected={isSelected}
                  onSelect={(v) => setSelection(toggleVerse(selection, v))}
                  commenterMarker={marker}
                  onMarkerClick={(v) => setOpenVerseSheet(v)}
                />
              </div>
              {bubblePosts.length > 0 && (
                <div className="hidden lg:flex lg:flex-col lg:gap-2 lg:w-72 lg:shrink-0 lg:p-3">
                  {bubblePosts.map((p) => (
                    <CommenterBubble key={p.id} post={p} />
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
```

`rail` 変数と `<div>` wrapper（`hidden lg:block fixed ...`）を撤去:

Before:
```typescript
  const rail = showRail && selectedUser ? (
    <ChapterCommentRail ... />
  ) : null
  // ...
      {verseList}
      {rail && (
        <div className="hidden lg:block fixed ...">
          {rail}
        </div>
      )}
```

After:
```typescript
  // rail 変数と wrapper を削除
      {verseList}
```

`showRail`/`showMarkers`/`showBubbles` 命名整理は上記通り。`showRail` を `showBubbles` にリネームしただけ。

- [ ] **Step 4: rail 関連ファイルを削除**

```bash
git rm -r apps/pwa/src/widgets/chapter-comment-rail \
          apps/pwa/tests/widgets/chapter-comment-rail
```

- [ ] **Step 5: pass 確認**

Run: `pnpm --filter pwa test chapter`
Expected: 20 tests passing (更新済み)

Run: `pnpm --filter pwa test`
Expected: 全 test pass（chapter-comment-rail のテストが削除されたので合計数は減る）

Run: `pnpm --filter pwa build`
Expected: 型エラーなし

- [ ] **Step 6: commit**

```bash
git add apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx \
        apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat(pages/scriptures): 右レールを CommenterBubble 吹き出しに置換し widget を削除"
```

---

## Task 5: 実機動作確認 + PR ready 化

**Files:** なし（Playwright MCP + PR 更新のみ）

### Steps

- [ ] **Step 1: verify skill で実機確認**

- Supabase / dev server の起動と test data 投入は既存パターン
- **デスクトップ (≥1024px)**:
  - 章画面のコンテナ幅が広がっている (`max-w-4xl` 相当)
  - 家族A 選択後、v3・v7 の各節右横に吹き出し（節本文と横並び）が出る
  - v7 は A の 2 件が縦にスタック
  - サークル外 C の投稿は吹き出しには出ない
- **モバイル (<1024px)**:
  - 節右に 👤 マーカー
  - マーカータップで Sheet が開き、内部が `max-h-[70vh]` でスクロール可
  - 多件時（v7 の 2 コメントなど）でスクロールできる
- `?view=who&user=xxx&mode=select` に入ると吹き出し・マーカーが消える
- 未ログイン `?view=who` は count fall-back

- [ ] **Step 2: git log 確認**

```bash
git status
git log main..HEAD --oneline
```

Expected: pivot spec + 4 タスク commit (計 5 commits) + 既存の PR #50 の 22 commit = 27 commits

- [ ] **Step 3: PR #50 に追加コメント**

```bash
gh pr comment 50 --body "spec pivot 実装完了。CommenterBubble 吹き出し方式に切り替えて Codex 指摘 P2 (レール overlay / Sheet スクロール) を解消。

## 変更点
- widgets/chapter-comment-rail 削除
- entities/post/ui/CommenterBubble.tsx 追加
- 節リストが lg で本文 + 吹き出しの flex 横並び
- __root.tsx: 章画面のみ max-w-md を lg:max-w-4xl に緩和
- VerseCommentSheet: max-h-[70vh] + overflow-y-auto

## 実機確認済 ✅
- デスクトップ: 節横の吹き出し
- モバイル: マーカー + Sheet スクロール"
```

---

## 自己レビュー結果

- **仕様カバレッジ**:
  - 節ごとの吹き出し → Task 1 + Task 4
  - Codex P2 rail overlay → Task 4（rail 撤去）+ Task 3（`max-w-md` 緩和）
  - Codex P2 Sheet スクロール → Task 2
  - PR #50 の既存機能保持 → Task 4 で `showBubbles` / `showMarkers` / `showToggle` / `showCommenters` cascade を維持
- **プレースホルダ**: 「TODO」「TBD」なし
- **型整合**: `PostWithUser` は既存の `@/entities/post/model`。`CompactPostCard` は既存の `entities/post/ui/CompactPostCard.tsx`。`CommenterBubble` は新規で `entities/post` に追加、tests/consumers も同じ path で import
- **依存関係**: Task 1 → Task 4（`CommenterBubble` を使う）、Task 2 と Task 3 は独立、Task 5 は全 task 完了後
