# 章コメント一覧「誰が」ビュー再設計 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 章画面 `/scriptures/:collection/:book/:chapter` に `件数 / 誰が` セグメント切替を導入し、`?view=who` モードでは章ヘッダーに「サークル内でこの章にコメントしている人」のアバター行を出す。アバターをタップ (`?user=<id>`) で 1 人にフォーカスし、デスクトップは右レール、モバイルは節右マーカータップで Sheet に、その人のコメントを表示する。

**Architecture:** `pages/scriptures/$collection/$book/$chapter.tsx` の loader が `chapterCommenters` / `selectedUser` / `selectedUserPosts` / `versesWithSelectedUser` を返す。UI 側は新規 `features/select-verse-view/`（`ViewModeToggle`, `ChapterCommentersRow`, URL パーサ）と、新規 `widgets/chapter-comment-rail/`（デスクトップ）+ `widgets/verse-comment-sheet/`（モバイル）を組み合わせ、既存 `features/select-scripture-verses/ui/VerseRow` に `commenterMarker` プロップを追加。カード見た目は `shared/ui/CompactPostCard` を新設して両 widget が使う。

**Tech Stack:** React 19 + TanStack Start / Vite / TypeScript / Base UI (Dialog, Popover) / TailwindCSS v4 / Vitest + @testing-library/react

## Global Constraints

- FSD レイヤー順守: `widgets → features → entities → shared`（上位層 → 下位層のみ）
- 新規 FSD スライスは必ず `index.ts` で公開 API を提供
- shadcn/ui は Base UI 版へ移行済み。新規プリミティブは `@base-ui/react` を使用
- コンポーネントテストは `apps/pwa/tests/` 配下に配置
- 変更ファイルパスはすべて `apps/pwa/` プレフィックス付きで指定
- TDD: 失敗テスト → 最小実装 → 通過 → コミット
- コメントは原則不要。WHY が自明でない場合のみ 1 行で記載
- 装飾用アイコンは `aria-hidden="true"` を付ける
- CSS 変数: `--lagoon`（アクセント）/ `--lagoon-deep`（リンク色）/ `--sea-ink`（本文色）/ `--sea-ink-soft`（薄い本文色）/ `--line`（ボーダー）/ `--chip-bg`（選択背景）/ `--chip-line`（チップ枠）/ `--palm`（バッジ色）/ `--header-bg`（ヘッダー背景）/ `--surface`（背景）を用いる
- 元設計との整合: [`2026-07-19-chapter-commenters-view-design.md`](../specs/2026-07-19-chapter-commenters-view-design.md)
- URL クエリ: `?view=who` のみが有効、`?user=<UUID>` は view=who かつサークル内かつ章に投稿ありの場合のみ効果あり。default `view=count` は URL に載せない
- サークル定義: 自分 ∪ フォロー中 (`follows.follower_id = me` → `following_id`) ∪ 家族 accepted (`family_relationships` 双方向 `status='accepted'`)
- `useIsMobile` (`apps/pwa/src/shared/hooks/use-mobile.tsx`) の閾値は 1024px（既存）
- `manna:verseWhoFilter:v1` の localStorage キーは触らない（デッドキーとして残す）

## ファイル構成

**新規:**
- `apps/pwa/src/features/select-verse-view/model/viewMode.ts` — `VerseViewMode` 型、`parseViewMode`、`serializeViewMode`
- `apps/pwa/src/features/select-verse-view/model/parseSelectedUser.ts` — URL の `user` パラメータ検証
- `apps/pwa/src/features/select-verse-view/ui/ViewModeToggle.tsx` — 件数／誰がセグメント
- `apps/pwa/src/features/select-verse-view/ui/ChapterCommentersRow.tsx` — ヘッダーのアバター行
- `apps/pwa/src/features/select-verse-view/index.ts` — Public API
- `apps/pwa/src/entities/user/lib/getCircleUserIds.ts` — サーバー用サークル取得
- `apps/pwa/src/entities/user/index.ts` — Public API
- `apps/pwa/src/shared/ui/AvatarStack.tsx` — アバタースタック（overflow +N 対応）
- `apps/pwa/src/shared/ui/CompactPostCard.tsx` — 縮小版 PostCard
- `apps/pwa/src/widgets/chapter-comment-rail/ui/ChapterCommentRail.tsx` — デスクトップ右レール
- `apps/pwa/src/widgets/chapter-comment-rail/index.ts` — Public API
- `apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx` — モバイル Sheet
- `apps/pwa/src/widgets/verse-comment-sheet/index.ts` — Public API
- `apps/pwa/tests/features/select-verse-view/viewMode.test.ts`
- `apps/pwa/tests/features/select-verse-view/parseSelectedUser.test.ts`
- `apps/pwa/tests/features/select-verse-view/ViewModeToggle.test.tsx`
- `apps/pwa/tests/features/select-verse-view/ChapterCommentersRow.test.tsx`
- `apps/pwa/tests/entities/user/getCircleUserIds.test.ts`
- `apps/pwa/tests/shared/ui/AvatarStack.test.tsx`
- `apps/pwa/tests/shared/ui/CompactPostCard.test.tsx`
- `apps/pwa/tests/widgets/chapter-comment-rail/ChapterCommentRail.test.tsx`
- `apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx`

**改修:**
- `apps/pwa/src/shared/ui/index.ts` — `AvatarStack`, `CompactPostCard` を export に追加
- `apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx` — `commenterMarker?: AvatarStackItem` プロップ追加
- `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` — `?view=who&user=<id>` パース、loader 拡張、UI 統合
- `apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx` — `commenterMarker` プロップのテスト追加
- `apps/pwa/tests/pages/scriptures/chapter.test.tsx` — `view=who` / `user` 経路のテスト追加

---

## Task 1: `VerseViewMode` 型と `parseViewMode` / `serializeViewMode` ヘルパー

**Files:**
- Create: `apps/pwa/src/features/select-verse-view/model/viewMode.ts`
- Create: `apps/pwa/tests/features/select-verse-view/viewMode.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type VerseViewMode = 'count' | 'who'`
  - `parseViewMode(input: unknown): VerseViewMode` — `'who'` のみ `'who'`、それ以外 `'count'`
  - `serializeViewMode(mode: VerseViewMode): 'who' | undefined` — `'who'` のみ `'who'`、`'count'` は `undefined`

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/features/select-verse-view/viewMode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseViewMode, serializeViewMode } from '@/features/select-verse-view/model/viewMode'

describe('parseViewMode', () => {
  it("'who' → 'who'", () => {
    expect(parseViewMode('who')).toBe('who')
  })
  it('undefined → count', () => {
    expect(parseViewMode(undefined)).toBe('count')
  })
  it('その他文字列 → count', () => {
    expect(parseViewMode('foo')).toBe('count')
    expect(parseViewMode('count')).toBe('count')
  })
  it('非文字列 → count', () => {
    expect(parseViewMode(1)).toBe('count')
    expect(parseViewMode(null)).toBe('count')
  })
})

describe('serializeViewMode', () => {
  it("'who' → 'who'", () => {
    expect(serializeViewMode('who')).toBe('who')
  })
  it("'count' → undefined", () => {
    expect(serializeViewMode('count')).toBeUndefined()
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm --filter pwa test viewMode`
Expected: Cannot find module `@/features/select-verse-view/model/viewMode`

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-verse-view/model/viewMode.ts`:

```typescript
export type VerseViewMode = 'count' | 'who'

export function parseViewMode(input: unknown): VerseViewMode {
  return input === 'who' ? 'who' : 'count'
}

export function serializeViewMode(mode: VerseViewMode): 'who' | undefined {
  return mode === 'who' ? 'who' : undefined
}
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test viewMode`
Expected: 6 tests passing

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/features/select-verse-view/model/viewMode.ts \
        apps/pwa/tests/features/select-verse-view/viewMode.test.ts
git commit -m "feat(select-verse-view): parseViewMode / serializeViewMode を追加"
```

---

## Task 2: `parseSelectedUser` URL パラメータ検証

**Files:**
- Create: `apps/pwa/src/features/select-verse-view/model/parseSelectedUser.ts`
- Create: `apps/pwa/tests/features/select-verse-view/parseSelectedUser.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `parseSelectedUser(input: unknown): string | undefined` — UUID 相当（16 進 + ハイフン、8〜36 文字）のみ通す

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/features/select-verse-view/parseSelectedUser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseSelectedUser } from '@/features/select-verse-view/model/parseSelectedUser'

describe('parseSelectedUser', () => {
  it('妥当な UUID 文字列は通す', () => {
    expect(parseSelectedUser('83e6c067-306b-4981-b957-98e2b4b74460')).toBe(
      '83e6c067-306b-4981-b957-98e2b4b74460',
    )
  })
  it('undefined は undefined', () => {
    expect(parseSelectedUser(undefined)).toBeUndefined()
  })
  it('空文字は undefined', () => {
    expect(parseSelectedUser('')).toBeUndefined()
  })
  it('不正文字を含むと undefined', () => {
    expect(parseSelectedUser('bogus user id')).toBeUndefined()
    expect(parseSelectedUser('<script>')).toBeUndefined()
  })
  it('非文字列は undefined', () => {
    expect(parseSelectedUser(null)).toBeUndefined()
    expect(parseSelectedUser(123)).toBeUndefined()
  })
  it('長すぎる文字列は undefined', () => {
    expect(parseSelectedUser('a'.repeat(37))).toBeUndefined()
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `pnpm --filter pwa test parseSelectedUser`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-verse-view/model/parseSelectedUser.ts`:

```typescript
const USER_ID_RE = /^[0-9a-f-]{8,36}$/i

export function parseSelectedUser(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined
  return USER_ID_RE.test(input) ? input : undefined
}
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test parseSelectedUser`
Expected: 6 tests passing

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/features/select-verse-view/model/parseSelectedUser.ts \
        apps/pwa/tests/features/select-verse-view/parseSelectedUser.test.ts
git commit -m "feat(select-verse-view): parseSelectedUser URL 検証を追加"
```

---

## Task 3: `AvatarStack` shared UI コンポーネント

**Files:**
- Create: `apps/pwa/src/shared/ui/AvatarStack.tsx`
- Modify: `apps/pwa/src/shared/ui/index.ts`
- Create: `apps/pwa/tests/shared/ui/AvatarStack.test.tsx`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type AvatarStackItem = { userId: string; name: string; avatarUrl: string | null }`
  - `<AvatarStack items max? ariaLabel? />` — `items.length === 0` は `null`

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/shared/ui/AvatarStack.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AvatarStack, type AvatarStackItem } from '@/shared/ui/AvatarStack'

const items: AvatarStackItem[] = [
  { userId: 'u1', name: '中村さん', avatarUrl: null },
  { userId: 'u2', name: '田中さん', avatarUrl: 'https://example.com/a.png' },
  { userId: 'u3', name: '佐藤さん', avatarUrl: null },
  { userId: 'u4', name: '鈴木さん', avatarUrl: null },
  { userId: 'u5', name: '山田さん', avatarUrl: null },
]

describe('AvatarStack', () => {
  it('空配列は何もレンダリングしない', () => {
    const { container } = render(<AvatarStack items={[]} />)
    expect(container.firstChild).toBeNull()
  })
  it('items <= max は全員描画、+N は出さない', () => {
    render(<AvatarStack items={items.slice(0, 3)} max={3} />)
    expect(screen.getByRole('img', { name: '田中さん' })).toBeInTheDocument()
    expect(screen.queryByText(/^\+/)).toBeNull()
  })
  it('items > max は max 個 + +N', () => {
    render(<AvatarStack items={items} max={3} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
  it('ariaLabel を role=group の aria-label に反映', () => {
    render(<AvatarStack items={items.slice(0, 2)} ariaLabel="2件" />)
    expect(screen.getByRole('group', { name: '2件' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test AvatarStack`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/shared/ui/AvatarStack.tsx`:

```typescript
export type AvatarStackItem = {
  userId: string
  name: string
  avatarUrl: string | null
}

type Props = {
  items: AvatarStackItem[]
  max?: number
  ariaLabel?: string
}

const SIZE = 20

export function AvatarStack({ items, max = 3, ariaLabel }: Props) {
  if (items.length === 0) return null
  const visible = items.slice(0, max)
  const overflow = Math.max(0, items.length - max)

  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center">
      {visible.map((item, i) => (
        <span
          key={item.userId}
          className="rounded-full shrink-0 overflow-hidden"
          style={{
            width: SIZE,
            height: SIZE,
            marginLeft: i === 0 ? 0 : -6,
            boxShadow: '0 0 0 1.5px var(--surface, #fff)',
            background: 'var(--lagoon)',
          }}
        >
          {item.avatarUrl ? (
            <img
              src={item.avatarUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              role="img"
              aria-label={item.name}
              className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white"
            >
              {item.name.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
          style={{
            width: SIZE,
            height: SIZE,
            marginLeft: -6,
            background: 'var(--chip-bg)',
            border: '1px solid var(--chip-line)',
            color: 'var(--palm)',
            boxShadow: '0 0 0 1.5px var(--surface, #fff)',
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: shared/ui/index.ts に export 追加**

現行 `apps/pwa/src/shared/ui/index.ts` の末尾に追加:

```typescript
export { AvatarStack, type AvatarStackItem } from './AvatarStack'
```

- [ ] **Step 5: pass 確認**

Run: `pnpm --filter pwa test AvatarStack`
Expected: 4 tests passing

- [ ] **Step 6: commit**

```bash
git add apps/pwa/src/shared/ui/AvatarStack.tsx \
        apps/pwa/src/shared/ui/index.ts \
        apps/pwa/tests/shared/ui/AvatarStack.test.tsx
git commit -m "feat(shared/ui): AvatarStack を追加"
```

---

## Task 4: `CompactPostCard` shared UI コンポーネント

**Files:**
- Create: `apps/pwa/src/shared/ui/CompactPostCard.tsx`
- Modify: `apps/pwa/src/shared/ui/index.ts`
- Create: `apps/pwa/tests/shared/ui/CompactPostCard.test.tsx`

**Interfaces:**
- Consumes: `PostWithUser` from `@/entities/post`, `formatDate` from `@/shared/lib/date`, `UserAvatar` from `@/shared/ui`, `getScriptureLabel` from `@/shared/lib/scriptureUtils`
- Produces:
  - `<CompactPostCard post ariaHref? />` — 縮小版 PostCard（アバター xs、本文 3 行 clamp、フッターに `📖 節N`）

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/shared/ui/CompactPostCard.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { CompactPostCard } from '@/shared/ui/CompactPostCard'
import type { PostWithUser } from '@/entities/post'

const post: PostWithUser = {
  id: 'post-1',
  content: '本文テキスト',
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

describe('CompactPostCard', () => {
  it('投稿本文と投稿者名を描画する', () => {
    renderInRouter(<CompactPostCard post={post} />)
    expect(screen.getByText('本文テキスト')).toBeInTheDocument()
    expect(screen.getByText('中村さん')).toBeInTheDocument()
  })

  it('scripture ラベルを描画する', () => {
    renderInRouter(<CompactPostCard post={post} />)
    expect(screen.getByText(/節7/)).toBeInTheDocument()
  })

  it('投稿ページへのリンクをアバター周辺に持つ', () => {
    renderInRouter(<CompactPostCard post={post} />)
    const link = screen.getByRole('link', { name: /本文テキスト/ })
    expect(link).toHaveAttribute('href', '/posts/post-1')
  })
})
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test CompactPostCard`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/shared/ui/CompactPostCard.tsx`:

```typescript
import { Link } from '@tanstack/react-router'
import type { PostWithUser } from '@/entities/post'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { formatDate } from '@/shared/lib/date'
import { getScriptureLabel } from '@/shared/lib/scriptureUtils'
import { UserAvatar } from '@/shared/ui'

type Props = {
  post: PostWithUser
}

export function CompactPostCard({ post }: Props) {
  const { displayName, avatarUrl } = resolveUserIdentity(post.users)
  const scriptureLabel =
    post.scripture_collection && post.scripture_book && post.scripture_chapter
      ? getScriptureLabel({
          collection: post.scripture_collection,
          book: post.scripture_book,
          chapter: post.scripture_chapter,
          verses: post.scripture_verses ?? undefined,
        })
      : null

  return (
    <Link
      to="/posts/$id"
      params={{ id: post.id }}
      className="block px-3 py-2 rounded-lg no-underline"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      aria-label={post.content}
    >
      <div className="flex items-center gap-2 mb-1">
        <UserAvatar name={displayName} url={avatarUrl} size="xs" />
        <span className="text-xs font-medium" style={{ color: 'var(--sea-ink)' }}>
          {displayName}
        </span>
        <time
          className="text-xs ml-auto"
          style={{ color: 'var(--sea-ink-soft)' }}
        >
          {formatDate(post.created_at)}
        </time>
      </div>
      <p
        className="text-sm whitespace-pre-wrap break-words"
        style={{
          color: 'var(--sea-ink)',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {post.content}
      </p>
      {scriptureLabel && (
        <div
          className="mt-1 text-xs"
          style={{ color: 'var(--lagoon-deep)' }}
        >
          📖 {scriptureLabel}
        </div>
      )}
    </Link>
  )
}
```

- [ ] **Step 4: shared/ui/index.ts に export 追加**

末尾に追記:

```typescript
export { CompactPostCard } from './CompactPostCard'
```

- [ ] **Step 5: pass 確認**

Run: `pnpm --filter pwa test CompactPostCard`
Expected: 3 tests passing

- [ ] **Step 6: commit**

```bash
git add apps/pwa/src/shared/ui/CompactPostCard.tsx \
        apps/pwa/src/shared/ui/index.ts \
        apps/pwa/tests/shared/ui/CompactPostCard.test.tsx
git commit -m "feat(shared/ui): CompactPostCard を追加"
```

---

## Task 5: `getCircleUserIds` サーバーヘルパー

**Files:**
- Create: `apps/pwa/src/entities/user/lib/getCircleUserIds.ts`
- Create: `apps/pwa/src/entities/user/index.ts`
- Create: `apps/pwa/tests/entities/user/getCircleUserIds.test.ts`

**Interfaces:**
- Consumes: `Awaited<ReturnType<typeof createSupabaseServer>>` 型（`@/shared/lib/auth`）
- Produces:
  - `type CircleUserRow = { id: string; display_name: string | null; avatar_url: string | null }`
  - `async function getCircleUserIds(supabase, userId): Promise<{ ids: string[]; users: CircleUserRow[] }>`

### Steps

- [ ] **Step 1: 失敗テストを作成**

`apps/pwa/tests/entities/user/getCircleUserIds.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { getCircleUserIds } from '@/entities/user/lib/getCircleUserIds'

function makeSupabase({
  follows,
  family,
  users,
}: {
  follows: { following_id: string }[]
  family: { requester_id: string; addressee_id: string }[]
  users: { id: string; display_name: string | null; avatar_url: string | null }[]
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'follows') {
        return { select: () => ({ eq: () => Promise.resolve({ data: follows }) }) }
      }
      if (table === 'family_relationships') {
        return {
          select: () => ({
            eq: () => ({ or: () => Promise.resolve({ data: family }) }),
          }),
        }
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: (_: string, ids: string[]) =>
              Promise.resolve({ data: users.filter((u) => ids.includes(u.id)) }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    }),
  }
}

describe('getCircleUserIds', () => {
  it('自分 + フォロー + 家族(accepted) を dedup', async () => {
    const supabase = makeSupabase({
      follows: [{ following_id: 'follow-a' }, { following_id: 'shared' }],
      family: [
        { requester_id: 'me', addressee_id: 'family-a' },
        { requester_id: 'shared', addressee_id: 'me' },
      ],
      users: [
        { id: 'me', display_name: '私', avatar_url: null },
        { id: 'follow-a', display_name: 'A', avatar_url: null },
        { id: 'family-a', display_name: 'B', avatar_url: null },
        { id: 'shared', display_name: 'C', avatar_url: null },
      ],
    })

    const result = await getCircleUserIds(
      supabase as unknown as Parameters<typeof getCircleUserIds>[0],
      'me',
    )
    expect(new Set(result.ids)).toEqual(new Set(['me', 'follow-a', 'family-a', 'shared']))
    expect(result.users).toHaveLength(4)
  })

  it('follows/family が null でも self だけ返す', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'follows') {
          return { select: () => ({ eq: () => Promise.resolve({ data: null }) }) }
        }
        if (table === 'family_relationships') {
          return {
            select: () => ({ eq: () => ({ or: () => Promise.resolve({ data: null }) }) }),
          }
        }
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [{ id: 'me', display_name: '私', avatar_url: null }],
              }),
          }),
        }
      }),
    }
    const result = await getCircleUserIds(
      supabase as unknown as Parameters<typeof getCircleUserIds>[0],
      'me',
    )
    expect(result.ids).toEqual(['me'])
    expect(result.users).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test getCircleUserIds`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/entities/user/lib/getCircleUserIds.ts`:

```typescript
import type { createSupabaseServer } from '@/shared/lib/auth'

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>

export type CircleUserRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

export async function getCircleUserIds(
  supabase: SupabaseServer,
  userId: string,
): Promise<{ ids: string[]; users: CircleUserRow[] }> {
  const [followsRes, familyRes] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', userId),
    supabase
      .from('family_relationships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
  ])

  const ids = new Set<string>([userId])
  ;(followsRes.data ?? []).forEach((f) =>
    ids.add((f as { following_id: string }).following_id),
  )
  ;(familyRes.data ?? []).forEach((r) => {
    const row = r as { requester_id: string; addressee_id: string }
    ids.add(row.requester_id === userId ? row.addressee_id : row.requester_id)
  })
  const idList = [...ids]

  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .in('id', idList)

  return { ids: idList, users: (users ?? []) as CircleUserRow[] }
}
```

- [ ] **Step 4: entities/user/index.ts を作成**

`apps/pwa/src/entities/user/index.ts`:

```typescript
export { getCircleUserIds, type CircleUserRow } from './lib/getCircleUserIds'
```

- [ ] **Step 5: pass 確認**

Run: `pnpm --filter pwa test getCircleUserIds`
Expected: 2 tests passing

- [ ] **Step 6: commit**

```bash
git add apps/pwa/src/entities/user/lib/getCircleUserIds.ts \
        apps/pwa/src/entities/user/index.ts \
        apps/pwa/tests/entities/user/getCircleUserIds.test.ts
git commit -m "feat(entities/user): getCircleUserIds を追加"
```

---

## Task 6: `ViewModeToggle` セグメントコントロール

**Files:**
- Create: `apps/pwa/src/features/select-verse-view/ui/ViewModeToggle.tsx`
- Create: `apps/pwa/tests/features/select-verse-view/ViewModeToggle.test.tsx`

**Interfaces:**
- Consumes: `VerseViewMode` from Task 1
- Produces: `<ViewModeToggle value onChange />` — `role="radiogroup"` + 2 `radio` (`件数` / `誰が`)

### Steps

- [ ] **Step 1: 失敗テスト**

`apps/pwa/tests/features/select-verse-view/ViewModeToggle.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewModeToggle } from '@/features/select-verse-view/ui/ViewModeToggle'

describe('ViewModeToggle', () => {
  it('radiogroup と 2 radio を描画', () => {
    render(<ViewModeToggle value="count" onChange={vi.fn()} />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '件数' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: '誰が' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })
  it('クリックで onChange を反対の値で呼ぶ', async () => {
    const onChange = vi.fn()
    render(<ViewModeToggle value="count" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: '誰が' }))
    expect(onChange).toHaveBeenCalledWith('who')
  })
  it('現在値と同じボタンでは onChange を呼ばない', async () => {
    const onChange = vi.fn()
    render(<ViewModeToggle value="who" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: '誰が' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test ViewModeToggle`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-verse-view/ui/ViewModeToggle.tsx`:

```typescript
import type { VerseViewMode } from '@/features/select-verse-view/model/viewMode'

type Props = {
  value: VerseViewMode
  onChange: (next: VerseViewMode) => void
}

const OPTIONS: { value: VerseViewMode; label: string }[] = [
  { value: 'count', label: '件数' },
  { value: 'who', label: '誰が' },
]

export function ViewModeToggle({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="節一覧の表示モード"
      className="inline-flex items-center rounded-full overflow-hidden"
      style={{ border: '1px solid var(--line)' }}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (!active) onChange(opt.value)
            }}
            className="px-3 py-1 text-xs font-medium transition-colors"
            style={{
              background: active ? 'var(--lagoon)' : 'transparent',
              color: active ? '#fff' : 'var(--sea-ink-soft)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test ViewModeToggle`
Expected: 3 tests passing

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/features/select-verse-view/ui/ViewModeToggle.tsx \
        apps/pwa/tests/features/select-verse-view/ViewModeToggle.test.tsx
git commit -m "feat(select-verse-view): ViewModeToggle を追加"
```

---

## Task 7: `ChapterCommentersRow`（ヘッダーのアバター行）

**Files:**
- Create: `apps/pwa/src/features/select-verse-view/ui/ChapterCommentersRow.tsx`
- Create: `apps/pwa/tests/features/select-verse-view/ChapterCommentersRow.test.tsx`

**Interfaces:**
- Consumes: `AvatarStackItem` from `@/shared/ui`, `UserAvatar` from `@/shared/ui`
- Produces:
  - `<ChapterCommentersRow commenters selectedUserId? onSelect onClear />`
  - `commenters: AvatarStackItem[]`, `selectedUserId: string | null`
  - `onSelect(userId: string)`, `onClear()`
  - 空配列時は案内文言 `フォロー中／家族のこの章への投稿はまだありません`

### Steps

- [ ] **Step 1: 失敗テスト**

`apps/pwa/tests/features/select-verse-view/ChapterCommentersRow.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChapterCommentersRow } from '@/features/select-verse-view/ui/ChapterCommentersRow'

const commenters = [
  { userId: 'u1', name: '中村さん', avatarUrl: null },
  { userId: 'u2', name: '田中さん', avatarUrl: null },
]

describe('ChapterCommentersRow', () => {
  it('コメンターが空なら案内文言を表示、ボタンは出さない', () => {
    render(
      <ChapterCommentersRow
        commenters={[]}
        selectedUserId={null}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(
      screen.getByText('フォロー中／家族のこの章への投稿はまだありません'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('各コメンターをボタンで描画する', () => {
    render(
      <ChapterCommentersRow
        commenters={commenters}
        selectedUserId={null}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '中村さん を選ぶ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '田中さん を選ぶ' })).toBeInTheDocument()
  })

  it('コメンターをクリックで onSelect を該当 ID で呼ぶ', async () => {
    const onSelect = vi.fn()
    render(
      <ChapterCommentersRow
        commenters={commenters}
        selectedUserId={null}
        onSelect={onSelect}
        onClear={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: '中村さん を選ぶ' }))
    expect(onSelect).toHaveBeenCalledWith('u1')
  })

  it('selectedUserId が指定されると解除ボタンが出て、押すと onClear', async () => {
    const onClear = vi.fn()
    render(
      <ChapterCommentersRow
        commenters={commenters}
        selectedUserId="u1"
        onSelect={vi.fn()}
        onClear={onClear}
      />,
    )
    const clear = screen.getByRole('button', { name: '選択解除' })
    await userEvent.click(clear)
    expect(onClear).toHaveBeenCalled()
  })

  it('selectedUserId が指定されているとき、該当アバターに aria-pressed が付く', () => {
    render(
      <ChapterCommentersRow
        commenters={commenters}
        selectedUserId="u1"
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: '中村さん を選ぶ' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '田中さん を選ぶ' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test ChapterCommentersRow`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-verse-view/ui/ChapterCommentersRow.tsx`:

```typescript
import type { AvatarStackItem } from '@/shared/ui'
import { UserAvatar } from '@/shared/ui'

type Props = {
  commenters: AvatarStackItem[]
  selectedUserId: string | null
  onSelect: (userId: string) => void
  onClear: () => void
}

export function ChapterCommentersRow({
  commenters,
  selectedUserId,
  onSelect,
  onClear,
}: Props) {
  if (commenters.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--sea-ink-soft)' }}>
        フォロー中／家族のこの章への投稿はまだありません
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <div className="flex items-center gap-1 shrink-0">
        {commenters.map((c) => {
          const active = c.userId === selectedUserId
          return (
            <button
              key={c.userId}
              type="button"
              aria-pressed={active}
              aria-label={`${c.name} を選ぶ`}
              onClick={() => onSelect(c.userId)}
              className="rounded-full transition-shadow"
              style={{
                boxShadow: active ? '0 0 0 2px var(--lagoon)' : 'none',
              }}
            >
              <UserAvatar name={c.name} url={c.avatarUrl} size="xs" />
            </button>
          )
        })}
      </div>
      {selectedUserId && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs shrink-0 underline"
          style={{ color: 'var(--lagoon-deep)' }}
        >
          選択解除
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test ChapterCommentersRow`
Expected: 5 tests passing

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/features/select-verse-view/ui/ChapterCommentersRow.tsx \
        apps/pwa/tests/features/select-verse-view/ChapterCommentersRow.test.tsx
git commit -m "feat(select-verse-view): ChapterCommentersRow を追加"
```

---

## Task 8: `select-verse-view` の Public API

**Files:**
- Create: `apps/pwa/src/features/select-verse-view/index.ts`

**Interfaces:**
- Consumes: Task 1, 2, 6, 7
- Produces: `parseViewMode`, `serializeViewMode`, `VerseViewMode`, `parseSelectedUser`, `ViewModeToggle`, `ChapterCommentersRow`

### Steps

- [ ] **Step 1: 実装**

`apps/pwa/src/features/select-verse-view/index.ts`:

```typescript
export {
  parseViewMode,
  serializeViewMode,
  type VerseViewMode,
} from './model/viewMode'
export { parseSelectedUser } from './model/parseSelectedUser'
export { ViewModeToggle } from './ui/ViewModeToggle'
export { ChapterCommentersRow } from './ui/ChapterCommentersRow'
```

- [ ] **Step 2: 経路経由で import が通ることを Task 1 のテストで確認**

`apps/pwa/tests/features/select-verse-view/viewMode.test.ts` の import を `@/features/select-verse-view` に差し替え:

```typescript
import { parseViewMode, serializeViewMode } from '@/features/select-verse-view'
```

Run: `pnpm --filter pwa test features/select-verse-view`
Expected: 既存全 pass

- [ ] **Step 3: commit**

```bash
git add apps/pwa/src/features/select-verse-view/index.ts \
        apps/pwa/tests/features/select-verse-view/viewMode.test.ts
git commit -m "feat(select-verse-view): 公開 API を index.ts で提供"
```

---

## Task 9: `ChapterCommentRail`（デスクトップ右レール widget）

**Files:**
- Create: `apps/pwa/src/widgets/chapter-comment-rail/ui/ChapterCommentRail.tsx`
- Create: `apps/pwa/src/widgets/chapter-comment-rail/index.ts`
- Create: `apps/pwa/tests/widgets/chapter-comment-rail/ChapterCommentRail.test.tsx`

**Interfaces:**
- Consumes: `PostWithUser` from `@/entities/post`, `CompactPostCard` from `@/shared/ui`
- Produces:
  - `<ChapterCommentRail posts selectedUserName />` — 右レール
  - `posts.length === 0` の時は `null`

### Steps

- [ ] **Step 1: 失敗テスト**

`apps/pwa/tests/widgets/chapter-comment-rail/ChapterCommentRail.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { ChapterCommentRail } from '@/widgets/chapter-comment-rail'
import type { PostWithUser } from '@/entities/post'

const posts: PostWithUser[] = [
  {
    id: 'p1',
    content: 'コメ 1',
    visibility: 'public',
    created_at: '2026-07-19T00:00:00.000Z',
    scripture_collection: 'bofm',
    scripture_book: '1-ne',
    scripture_chapter: 3,
    scripture_verses: [7],
    user_id: 'u1',
    users: { display_name: '中村さん', avatar_url: null },
  },
  {
    id: 'p2',
    content: 'コメ 2',
    visibility: 'public',
    created_at: '2026-07-18T00:00:00.000Z',
    scripture_collection: 'bofm',
    scripture_book: '1-ne',
    scripture_chapter: 3,
    scripture_verses: [15],
    user_id: 'u1',
    users: { display_name: '中村さん', avatar_url: null },
  },
]

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

describe('ChapterCommentRail', () => {
  it('posts が空なら null を返す', () => {
    const { container } = renderInRouter(
      <ChapterCommentRail posts={[]} selectedUserName="中村さん" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('posts を CompactPostCard として並べる', () => {
    renderInRouter(<ChapterCommentRail posts={posts} selectedUserName="中村さん" />)
    expect(screen.getByText('コメ 1')).toBeInTheDocument()
    expect(screen.getByText('コメ 2')).toBeInTheDocument()
  })

  it('レール見出しに選択ユーザー名を出す', () => {
    renderInRouter(<ChapterCommentRail posts={posts} selectedUserName="中村さん" />)
    expect(screen.getByRole('heading', { name: /中村さんのコメント/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test widgets/chapter-comment-rail`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/widgets/chapter-comment-rail/ui/ChapterCommentRail.tsx`:

```typescript
import type { PostWithUser } from '@/entities/post'
import { CompactPostCard } from '@/shared/ui'

type Props = {
  posts: PostWithUser[]
  selectedUserName: string
}

export function ChapterCommentRail({ posts, selectedUserName }: Props) {
  if (posts.length === 0) return null

  return (
    <aside
      className="w-80 shrink-0 border-l pl-4 pr-2 py-3"
      style={{ borderColor: 'var(--line)' }}
    >
      <h2
        className="text-xs font-semibold mb-2"
        style={{ color: 'var(--sea-ink-soft)' }}
      >
        {selectedUserName}のコメント
      </h2>
      <div className="flex flex-col gap-2">
        {posts.map((p) => (
          <CompactPostCard key={p.id} post={p} />
        ))}
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: `widgets/chapter-comment-rail/index.ts` を作成**

```typescript
export { ChapterCommentRail } from './ui/ChapterCommentRail'
```

- [ ] **Step 5: pass 確認**

Run: `pnpm --filter pwa test widgets/chapter-comment-rail`
Expected: 3 tests passing

- [ ] **Step 6: commit**

```bash
git add apps/pwa/src/widgets/chapter-comment-rail/ui/ChapterCommentRail.tsx \
        apps/pwa/src/widgets/chapter-comment-rail/index.ts \
        apps/pwa/tests/widgets/chapter-comment-rail/ChapterCommentRail.test.tsx
git commit -m "feat(widgets/chapter-comment-rail): デスクトップ右レール widget を追加"
```

---

## Task 10: `VerseCommentSheet`（モバイル Sheet widget）

**Files:**
- Create: `apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx`
- Create: `apps/pwa/src/widgets/verse-comment-sheet/index.ts`
- Create: `apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx`

**Interfaces:**
- Consumes: `PostWithUser` from `@/entities/post`, `CompactPostCard` from `@/shared/ui`, `Sheet` primitives from `@/shared/ui/sheet`
- Produces:
  - `<VerseCommentSheet open verse selectedUserName posts onOpenChange />`
  - `posts` は「その節における選択ユーザーの投稿」新着順

### Steps

- [ ] **Step 1: 失敗テスト**

`apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { VerseCommentSheet } from '@/widgets/verse-comment-sheet'
import type { PostWithUser } from '@/entities/post'

const posts: PostWithUser[] = [
  {
    id: 'p1',
    content: '節7 への A の投稿',
    visibility: 'public',
    created_at: '2026-07-19T00:00:00.000Z',
    scripture_collection: 'bofm',
    scripture_book: '1-ne',
    scripture_chapter: 3,
    scripture_verses: [7],
    user_id: 'u1',
    users: { display_name: '中村さん', avatar_url: null },
  },
]

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

describe('VerseCommentSheet', () => {
  it('open=true でヘッダーに節と選択ユーザー名を出す', () => {
    renderInRouter(
      <VerseCommentSheet
        open={true}
        verse={7}
        selectedUserName="中村さん"
        posts={posts}
        onOpenChange={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('heading', { name: /節7.*中村さん/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('節7 への A の投稿')).toBeInTheDocument()
  })

  it('open=false では中身を出さない', () => {
    renderInRouter(
      <VerseCommentSheet
        open={false}
        verse={7}
        selectedUserName="中村さん"
        posts={posts}
        onOpenChange={vi.fn()}
      />,
    )
    expect(screen.queryByText('節7 への A の投稿')).toBeNull()
  })
})
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test widgets/verse-comment-sheet`
Expected: module not found

- [ ] **Step 3: 実装**

`apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx`:

```typescript
import type { PostWithUser } from '@/entities/post'
import { CompactPostCard } from '@/shared/ui'
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
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>
            📖 節{verse} — {selectedUserName}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-4">
          {posts.map((p) => (
            <CompactPostCard key={p.id} post={p} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: `widgets/verse-comment-sheet/index.ts`**

```typescript
export { VerseCommentSheet } from './ui/VerseCommentSheet'
```

- [ ] **Step 5: pass 確認**

Run: `pnpm --filter pwa test widgets/verse-comment-sheet`
Expected: 2 tests passing

- [ ] **Step 6: commit**

```bash
git add apps/pwa/src/widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx \
        apps/pwa/src/widgets/verse-comment-sheet/index.ts \
        apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx
git commit -m "feat(widgets/verse-comment-sheet): モバイル Sheet widget を追加"
```

---

## Task 11: `VerseRow` に `commenterMarker` プロップ

**Files:**
- Modify: `apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx`
- Modify: `apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx`

**Interfaces:**
- Consumes: `AvatarStackItem` from `@/shared/ui`
- Produces: `Props.commenterMarker?: AvatarStackItem` — 存在すれば節右にミニアバターマーカーを描画。従来の件数バッジは `view` プロップ（削除）に依存しない — バッジは既存動作を維持
- Marker が押されると `onMarkerClick?: (verse: number) => void` を発火

### Steps

- [ ] **Step 1: 失敗テスト**

`apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx` の末尾に追記:

```typescript
describe('VerseRow commenterMarker', () => {
  const marker = { userId: 'u1', name: '中村さん', avatarUrl: null }

  it('commenterMarker があるとマーカーボタンを出し、押下で onMarkerClick を呼ぶ', async () => {
    const onMarkerClick = vi.fn()
    renderInRouter(
      <VerseRow
        {...baseProps}
        mode="read"
        selected={false}
        onSelect={vi.fn()}
        commenterMarker={marker}
        onMarkerClick={onMarkerClick}
      />,
    )
    const btn = await screen.findByRole('button', {
      name: '中村さん の 19節 コメントを見る',
    })
    await userEvent.click(btn)
    expect(onMarkerClick).toHaveBeenCalledWith(19)
  })

  it('commenterMarker 無しならマーカーは出さない', async () => {
    renderInRouter(
      <VerseRow {...baseProps} mode="read" selected={false} onSelect={vi.fn()} />,
    )
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /コメントを見る/ }),
      ).toBeNull()
    })
  })
})
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test VerseRow`
Expected: `commenterMarker` プロップ未定義エラー

- [ ] **Step 3: 実装**

`apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx` を以下に差し替え:

```typescript
import type { CSSProperties, MouseEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, ChevronRight } from 'lucide-react'
import { SanitizedVerseHtml, UserAvatar } from '@/shared/ui'
import type { AvatarStackItem } from '@/shared/ui'

const ROW_TRANSITION = 'background-color 200ms, border-color 200ms'
const ROW_SELECTED_STYLE: CSSProperties = {
  background: 'var(--chip-bg)',
  borderLeft: '3px solid var(--lagoon)',
  transition: ROW_TRANSITION,
}
const ROW_UNSELECTED_STYLE: CSSProperties = {
  background: 'transparent',
  borderLeft: '3px solid transparent',
  transition: ROW_TRANSITION,
}

type Props = {
  collection: string
  book: string
  chapter: number
  verse: number
  textHtml?: string
  count: number
  mode: 'read' | 'select'
  selected: boolean
  onSelect: (verse: number) => void
  commenterMarker?: AvatarStackItem
  onMarkerClick?: (verse: number) => void
}

export function VerseRow({
  collection,
  book,
  chapter,
  verse,
  textHtml,
  count,
  mode,
  selected,
  onSelect,
  commenterMarker,
  onMarkerClick,
}: Props) {
  const containerStyle = selected ? ROW_SELECTED_STYLE : ROW_UNSELECTED_STYLE

  const handleMarkerClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onMarkerClick?.(verse)
  }

  const rightBadge = commenterMarker ? (
    <button
      type="button"
      aria-label={`${commenterMarker.name} の ${verse}節 コメントを見る`}
      onClick={handleMarkerClick}
      className="shrink-0 rounded-full"
    >
      <UserAvatar
        name={commenterMarker.name}
        url={commenterMarker.avatarUrl}
        size="xs"
      />
    </button>
  ) : count > 0 ? (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
      style={{
        background: 'var(--chip-bg)',
        border: '1px solid var(--chip-line)',
        color: 'var(--palm)',
      }}
    >
      {count}件
    </span>
  ) : null

  const inner = (
    <div className="flex items-start gap-2 px-4 py-3">
      {mode === 'select' && (
        <div
          aria-hidden="true"
          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors"
          style={{
            border: `1.5px solid ${selected ? 'var(--lagoon)' : 'var(--line)'}`,
            background: selected ? 'var(--lagoon)' : 'transparent',
          }}
        >
          {selected && (
            <Check size={12} strokeWidth={3} color="#fff" aria-hidden="true" />
          )}
        </div>
      )}
      <div
        className="flex-1 min-w-0 flex items-start justify-between gap-2"
        style={{ color: 'var(--sea-ink)' }}
      >
        <div className="flex-1 min-w-0">
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--sea-ink-soft)' }}
          >
            {verse}
          </span>
          {textHtml && (
            <SanitizedVerseHtml
              html={textHtml}
              className="ml-2 text-sm"
              style={{ color: 'var(--sea-ink)' }}
            />
          )}
        </div>
        {rightBadge}
        {mode === 'read' && (
          <ChevronRight
            size={16}
            className="shrink-0 mt-0.5"
            style={{ color: 'var(--sea-ink-soft)' }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )

  if (mode === 'select') {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={`${verse}節を選択`}
        onClick={() => onSelect(verse)}
        className="w-full text-left"
        style={containerStyle}
      >
        {inner}
      </button>
    )
  }

  return (
    <Link
      to="/scriptures/$collection/$book/$chapter"
      params={{ collection, book, chapter: String(chapter) }}
      search={{ verses: [verse] }}
      className="block"
      style={containerStyle}
    >
      {inner}
    </Link>
  )
}
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test VerseRow`
Expected: 既存 4 + 新規 2 = 6 tests passing

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/features/select-scripture-verses/ui/VerseRow.tsx \
        apps/pwa/tests/features/select-scripture-verses/VerseRow.test.tsx
git commit -m "feat(select-scripture-verses): VerseRow に commenterMarker プロップ追加"
```

---

## Task 12: 章 loader を `view=who` / `user` で分岐

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`
- Modify: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes:
  - `parseViewMode`, `parseSelectedUser`, `type VerseViewMode` from `@/features/select-verse-view`
  - `getCircleUserIds` from `@/entities/user`
  - `AvatarStackItem` from `@/shared/ui`
  - `PostWithUser`, `POST_SELECT` from `@/entities/post`
- Produces（chapter mode loader 戻り値に追加）:
  - `view: VerseViewMode`
  - `chapterCommenters: AvatarStackItem[]`
  - `selectedUser: AvatarStackItem | null`
  - `selectedUserPosts: PostWithUser[]`
  - `versesWithSelectedUser: number[]`

### Steps

- [ ] **Step 1: `validateSearch` テストと `TestLoaderData` を拡張**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の `TestLoaderData` に追加:

```typescript
  view: 'count' | 'who'
  chapterCommenters: { userId: string; name: string; avatarUrl: string | null }[]
  selectedUser: { userId: string; name: string; avatarUrl: string | null } | null
  selectedUserPosts: PostWithUser[]
  versesWithSelectedUser: number[]
```

`baseChapterData` に:

```typescript
  view: 'count' as const,
  chapterCommenters: [],
  selectedUser: null,
  selectedUserPosts: [],
  versesWithSelectedUser: [],
```

`validateSearch` テストブロックに追記:

```typescript
    expect(validate({ view: 'who' })).toMatchObject({ view: 'who' })
    expect(validate({ view: 'foo' })).toMatchObject({ view: undefined })
    expect(validate({ user: '83e6c067-306b-4981-b957-98e2b4b74460' })).toMatchObject({
      user: '83e6c067-306b-4981-b957-98e2b4b74460',
    })
    expect(validate({ user: 'invalid user' })).toMatchObject({ user: undefined })
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test chapter`
Expected: `validateSearch` テストで `view` / `user` プロパティ未定義エラー

- [ ] **Step 3: `validateSearch` と loader を実装**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の import に追加:

```typescript
import {
  parseViewMode,
  parseSelectedUser,
  type VerseViewMode,
} from '@/features/select-verse-view'
import { getCircleUserIds } from '@/entities/user'
import type { AvatarStackItem } from '@/shared/ui'
```

`ChapterSearch` と `validateSearch`:

```typescript
type ChapterSearch = {
  verses?: number[]
  select?: number[]
  mode?: SelectionMode
  view?: 'who'
  user?: string
}

export const Route = createFileRoute('/scriptures/$collection/$book/$chapter')({
  validateSearch: (search: Record<string, unknown>): ChapterSearch => ({
    verses: search.verses !== undefined ? parseSelection(search.verses) : undefined,
    select: search.select !== undefined ? parseSelection(search.select) : undefined,
    mode: search.mode === 'select' ? 'select' : undefined,
    view: search.view === 'who' ? 'who' : undefined,
    user: parseSelectedUser(search.user),
  }),
  loaderDeps: ({ search }) => ({
    verses: search.verses,
    view: search.view,
    user: search.user,
  }),
  loader: async ({ params, deps }) => { /* 下記 */ },
  component: ChapterPage,
})
```

`fetchChapterData` を書き換え:

```typescript
async function queryUserAndCircle(supabase: SupabaseServer, view: VerseViewMode) {
  const userId = await queryCurrentUserId(supabase)
  const circle =
    view === 'who' && userId !== null
      ? await getCircleUserIds(supabase, userId)
      : null
  return { userId, circle }
}

const fetchChapterData = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: ChapterRef & { view: VerseViewMode; user: string | undefined }) => data,
  )
  .handler(async (ctx) => {
    const { collection, book, chapter, view, user } = ctx.data
    const serverSupabase = await createSupabaseServer()

    const [
      { data: posts },
      { data: versePostsData },
      verseTexts,
      { userId, circle },
    ] = await Promise.all([
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .is('scripture_verses', null)
        .order('created_at', { ascending: false }),
      serverSupabase
        .from('posts')
        .select('user_id, scripture_verses, created_at')
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .not('scripture_verses', 'is', null),
      queryVerseTexts(serverSupabase, ctx.data),
      queryUserAndCircle(serverSupabase, view),
    ])

    const versePosts = versePostsData ?? []

    const countByVerse: Record<number, number> = {}
    versePosts.forEach((p) => {
      ;(p.scripture_verses as number[] | null)?.forEach((v) => {
        countByVerse[v] = (countByVerse[v] ?? 0) + 1
      })
    })

    let chapterCommenters: AvatarStackItem[] = []
    let selectedUser: AvatarStackItem | null = null
    let selectedUserPosts: PostWithUser[] = []
    let versesWithSelectedUser: number[] = []

    if (circle) {
      const userLookup = new Map(
        circle.users.map((u) => [
          u.id,
          {
            userId: u.id,
            name: u.display_name ?? '匿名ユーザー',
            avatarUrl: u.avatar_url,
          } as AvatarStackItem,
        ]),
      )

      const latestByUser = new Map<string, string>()
      for (const p of versePosts) {
        const uid = p.user_id as string
        if (!userLookup.has(uid)) continue
        const prev = latestByUser.get(uid) ?? ''
        const cur = p.created_at ?? ''
        if (cur > prev) latestByUser.set(uid, cur)
      }
      chapterCommenters = [...latestByUser.entries()]
        .sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
        .map(([uid]) => userLookup.get(uid)!)

      const validUser = user && latestByUser.has(user) ? user : null
      if (validUser) {
        selectedUser = userLookup.get(validUser)!
        const versesSet = new Set<number>()
        for (const p of versePosts) {
          if ((p.user_id as string) !== validUser) continue
          ;((p.scripture_verses as number[] | null) ?? []).forEach((v) =>
            versesSet.add(v),
          )
        }
        versesWithSelectedUser = [...versesSet].sort((a, b) => a - b)

        const { data: userPosts } = await serverSupabase
          .from('posts')
          .select(POST_SELECT)
          .eq('scripture_collection', collection)
          .eq('scripture_book', book)
          .eq('scripture_chapter', chapter)
          .eq('user_id', validUser)
          .not('scripture_verses', 'is', null)
          .order('created_at', { ascending: false })
        selectedUserPosts = (userPosts ?? []) as PostWithUser[]
      }
    }

    return {
      posts: (posts ?? []) as PostWithUser[],
      countByVerse,
      verseTexts,
      userId,
      view: circle ? ('who' as const) : ('count' as const),
      chapterCommenters,
      selectedUser,
      selectedUserPosts,
      versesWithSelectedUser,
    }
  })
```

`loader` 本体で `view` / `user` を渡す:

```typescript
    if (deps.verses?.length) {
      const verseCount = book.verses[chapterNum - 1]
      if (deps.verses.some((v) => v < 1 || v > verseCount)) throw notFound()
      const { posts, verseTexts, userId } = await fetchVerseData({
        data: { ...base, verses: deps.verses },
      })
      return {
        book, chapter: chapterNum, collection: params.collection,
        mode: 'verse' as const, verses: deps.verses,
        posts, countByVerse: {} as Record<number, number>, verseTexts, userId,
        view: 'count' as const,
        chapterCommenters: [] as AvatarStackItem[],
        selectedUser: null as AvatarStackItem | null,
        selectedUserPosts: [] as PostWithUser[],
        versesWithSelectedUser: [] as number[],
      }
    }

    const view = parseViewMode(deps.view)
    const data = await fetchChapterData({
      data: { ...base, view, user: deps.user },
    })

    return {
      book, chapter: chapterNum, collection: params.collection,
      mode: 'chapter' as const, verses: [] as number[],
      ...data,
    }
```

`ChapterViewProps` に対応プロップ追加（実際の UI 統合は Task 13）:

```typescript
type ChapterViewProps = {
  book: Book
  chapter: number
  collection: string
  posts: PostWithUser[]
  countByVerse: Record<number, number>
  verseTexts: VerseText[]
  canCompose: boolean
  view: VerseViewMode
  chapterCommenters: AvatarStackItem[]
  selectedUser: AvatarStackItem | null
  selectedUserPosts: PostWithUser[]
  versesWithSelectedUser: number[]
}
```

`ChapterPage` の分岐でも新プロパティを渡す:

```typescript
  return <ChapterView
    book={data.book}
    chapter={data.chapter}
    collection={data.collection}
    posts={data.posts}
    countByVerse={data.countByVerse}
    verseTexts={data.verseTexts}
    canCompose={Boolean(data.userId)}
    view={data.view}
    chapterCommenters={data.chapterCommenters}
    selectedUser={data.selectedUser}
    selectedUserPosts={data.selectedUserPosts}
    versesWithSelectedUser={data.versesWithSelectedUser}
  />
```

- [ ] **Step 4: pass 確認**

Run: `pnpm --filter pwa test chapter`
Expected: 既存 + 新規 4 ケース pass

Run: `pnpm --filter pwa build`
Expected: 型エラーなし

- [ ] **Step 5: commit**

```bash
git add apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx \
        apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat(pages/scriptures): 章 loader を view=who / user で分岐"
```

---

## Task 13: 章画面 UI に `ChapterCommentersRow` / `ChapterCommentRail` / `VerseCommentSheet` を統合

**Files:**
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`
- Modify: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`

**Interfaces:**
- Consumes:
  - `ViewModeToggle`, `ChapterCommentersRow`, `serializeViewMode` from `@/features/select-verse-view`
  - `ChapterCommentRail` from `@/widgets/chapter-comment-rail`
  - `VerseCommentSheet` from `@/widgets/verse-comment-sheet`
  - `useIsMobile` from `@/shared/hooks/use-mobile`
- Produces:
  - `canCompose === false` の場合、Toggle と Commenter 行は描画しない
  - `view === 'who'` かつ `canCompose === true` の場合、ヘッダー下部に `ChapterCommentersRow` を描画
  - `useIsMobile === false` の場合、`selectedUser` があれば `ChapterCommentRail` を右側に描画（本文と flex 横並び）
  - `useIsMobile === true` の場合、`versesWithSelectedUser` に含まれる節に `commenterMarker` を渡し、マーカータップで `VerseCommentSheet` を開く
  - `mode === 'select'` 中は Toggle / Commenter 行 / マーカー / 右レール / Sheet すべて隠す

### Steps

- [ ] **Step 1: 失敗テスト**

`apps/pwa/tests/pages/scriptures/chapter.test.tsx` の末尾に追記:

```typescript
  it('ログイン済み view=count なら件数／誰がセグメントを描画', () => {
    render(<ChapterPage />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '件数' })).toHaveAttribute('aria-checked', 'true')
  })

  it("view=count で「誰が」を押すと navigate({ view: 'who' })", async () => {
    const user = userEvent.setup()
    render(<ChapterPage />)
    await user.click(screen.getByRole('radio', { name: '誰が' }))
    expect(navigateSpy).toHaveBeenCalled()
    const call = navigateSpy.mock.calls.at(-1)?.[0]
    expect(call.search({})).toMatchObject({ view: 'who' })
  })

  it('view=who かつ chapterCommenters ありでヘッダーにアバターボタンを描画', () => {
    loaderData = {
      ...baseChapterData,
      view: 'who',
      chapterCommenters: [
        { userId: 'u1', name: '中村さん', avatarUrl: null },
      ],
    }
    render(<ChapterPage />)
    expect(
      screen.getByRole('button', { name: '中村さん を選ぶ' }),
    ).toBeInTheDocument()
  })

  it('選択済みだと解除ボタン、選択解除で user=undefined を navigate', async () => {
    loaderData = {
      ...baseChapterData,
      view: 'who',
      chapterCommenters: [
        { userId: 'u1', name: '中村さん', avatarUrl: null },
      ],
      selectedUser: { userId: 'u1', name: '中村さん', avatarUrl: null },
    }
    const user = userEvent.setup()
    render(<ChapterPage />)
    await user.click(screen.getByRole('button', { name: '選択解除' }))
    const call = navigateSpy.mock.calls.at(-1)?.[0]
    expect(call.search({ user: 'u1' })).toMatchObject({ user: undefined })
  })

  it('未ログインならセグメントもアバター行も出さない', () => {
    loaderData = { ...baseChapterData, userId: null }
    render(<ChapterPage />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })
```

- [ ] **Step 2: 失敗確認**

Run: `pnpm --filter pwa test chapter`
Expected: 新規 5 テスト失敗

- [ ] **Step 3: 実装 — import**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の import に追加:

```typescript
import {
  ViewModeToggle,
  ChapterCommentersRow,
  serializeViewMode,
} from '@/features/select-verse-view'
import { ChapterCommentRail } from '@/widgets/chapter-comment-rail'
import { VerseCommentSheet } from '@/widgets/verse-comment-sheet'
import { useIsMobile } from '@/shared/hooks/use-mobile'
```

- [ ] **Step 4: 実装 — `ChapterView` に統合**

`ChapterView` を以下に差し替える（既存の`ChapterView`関数を丸ごと置き換える）:

```typescript
function ChapterView({
  book, chapter, collection, posts, countByVerse, verseTexts, canCompose,
  view, chapterCommenters, selectedUser, selectedUserPosts, versesWithSelectedUser,
}: ChapterViewProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [composerVerses, setComposerVerses] = useState<number[] | undefined>()
  const [openVerseSheet, setOpenVerseSheet] = useState<number | null>(null)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter })
  const maxVerse = book.verses[chapter - 1]

  const verseTextMap = useMemo(
    () => new Map(verseTexts.map((vt) => [vt.verse, vt])),
    [verseTexts],
  )
  const verseNumbers = Array.from({ length: maxVerse }, (_, i) => i + 1)
  const selection = useMemo(
    () => parseSelection(search.select, maxVerse),
    [search.select, maxVerse],
  )
  const mode: SelectionMode = canCompose && search.mode === 'select' ? 'select' : 'read'

  const patchSearch = (patch: Partial<ChapterSearch>, replace = true) => {
    navigate({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection, book: book.id, chapter: String(chapter) },
      search: (prev) => ({ ...prev, ...patch }),
      replace,
    })
  }

  const setSelection = (next: number[]) =>
    patchSearch({ select: next.length ? next : undefined })
  const enterSelectMode = () => patchSearch({ mode: 'select' }, false)
  const exitSelectMode = () => patchSearch({ mode: undefined, select: undefined })
  const setView = (next: VerseViewMode) =>
    patchSearch({ view: serializeViewMode(next), user: undefined })
  const selectUser = (userId: string) =>
    patchSearch({ user: userId })
  const clearUser = () => patchSearch({ user: undefined })

  const versesWithMarker = useMemo(
    () => new Set(versesWithSelectedUser),
    [versesWithSelectedUser],
  )

  const postsByVerse = useMemo(() => {
    const map = new Map<number, PostWithUser[]>()
    for (const p of selectedUserPosts) {
      ;((p.scripture_verses as number[] | null) ?? []).forEach((v) => {
        const arr = map.get(v) ?? []
        arr.push(p)
        map.set(v, arr)
      })
    }
    return map
  }, [selectedUserPosts])

  const openComposerForChapter = () => {
    setComposerVerses(undefined)
    setSheetOpen(true)
  }
  const openComposerForSelection = () => {
    setComposerVerses(selection)
    setSheetOpen(true)
  }
  const onSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) router.invalidate()
  }
  const onComposerClosed = () => {
    if (mode === 'select') exitSelectMode()
  }

  const showToggle = canCompose && mode !== 'select'
  const showCommenters = showToggle && view === 'who'
  const showRail = !isMobile && selectedUser !== null && selectedUserPosts.length > 0
  const showMarkers = isMobile && selectedUser !== null

  const headerAction = (
    <div className="flex items-center gap-3">
      <a
        href={officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs underline"
        style={{ color: 'var(--lagoon-deep)' }}
      >
        本文
      </a>
      {showToggle && <ViewModeToggle value={view} onChange={setView} />}
      {canCompose && (
        <ComposeMenu
          onSelectChapter={openComposerForChapter}
          onSelectVerses={enterSelectMode}
        />
      )}
    </div>
  )

  const chapterHeader = (
    <>
      <PageHeader
        title={`${book.name} 第${chapter}章`}
        backTo="/scriptures/$collection/$book"
        backLabel={book.name}
        action={headerAction}
      />
      {showCommenters && (
        <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--line)' }}>
          <ChapterCommentersRow
            commenters={chapterCommenters}
            selectedUserId={selectedUser?.userId ?? null}
            onSelect={selectUser}
            onClear={clearUser}
          />
        </div>
      )}
    </>
  )

  const selectionHeader = (
    <SelectionModeHeader
      count={selection.length}
      onCancel={exitSelectMode}
      onSubmit={openComposerForSelection}
    />
  )

  const verseList = (
    <div className="p-4 pb-24 flex-1 min-w-0">
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
          return (
            <li
              key={verse}
              className="border-b last:border-b-0"
              style={{ borderColor: 'var(--line)' }}
            >
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
            </li>
          )
        })}
      </ul>
    </div>
  )

  const rail = showRail && selectedUser ? (
    <ChapterCommentRail
      posts={selectedUserPosts}
      selectedUserName={selectedUser.name}
    />
  ) : null

  const activeVerseSheet =
    openVerseSheet !== null && selectedUser ? (
      <VerseCommentSheet
        open={openVerseSheet !== null}
        verse={openVerseSheet}
        selectedUserName={selectedUser.name}
        posts={postsByVerse.get(openVerseSheet) ?? []}
        onOpenChange={(open) => {
          if (!open) setOpenVerseSheet(null)
        }}
      />
    ) : null

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
      <div className="flex">
        {verseList}
        {rail}
      </div>
      {canCompose && (
        <PostComposerSheet
          open={sheetOpen}
          onOpenChange={onSheetOpenChange}
          onClosed={onComposerClosed}
          initialScripture={{
            collection,
            book: book.id,
            chapter,
            verses: composerVerses,
          }}
        />
      )}
      {activeVerseSheet}
    </div>
  )
}
```

- [ ] **Step 5: pass 確認**

Run: `pnpm --filter pwa test chapter`
Expected: 全テスト pass

Run: `pnpm --filter pwa test`
Expected: 既存全テスト + 新規テストが pass

Run: `pnpm --filter pwa build`
Expected: 型エラー・build エラーなし

- [ ] **Step 6: commit**

```bash
git add apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx \
        apps/pwa/tests/pages/scriptures/chapter.test.tsx
git commit -m "feat(pages/scriptures): 章画面に ChapterCommentersRow / Rail / Sheet を統合"
```

---

## Task 14: Playwright MCP 実機確認と PR 更新

**Files:** なし（動作確認 + PR ready-for-review 切り替え）

**Interfaces:** Task 1〜13 のすべて

### Steps

- [ ] **Step 1: verify skill で実機確認**

`verify` skill の手順に従い、Supabase ローカル + Vite dev を起動して以下を確認:

- ログイン済みでヘッダー右に `件数 / 誰が` セグメントが出る
- `誰が` に切替えると URL に `?view=who` が付き、ヘッダー下にサークル内章コメンターのアバター行が出る
- サークル内章コメンターがゼロなら案内文言が出る
- アバターをタップすると URL に `?view=who&user=<id>` が付き、選択状態になる
- **デスクトップ** (`≥1024px`): 節本文の右にコメントレールが出て、選択ユーザーの投稿が並ぶ
- **モバイル** (`<1024px`): 該当節に 👤 マーカーが付き、タップで下から Sheet が開いてその節の全コメント（新着順）を表示
- 選択解除ボタンで `user` が URL から消える
- 未ログインではセグメントも Commenter 行もマーカーも出ない
- `?view=who&user=xxx` を未ログインで直踏みしても count として描画される
- `user=invalid` のような不正値でも解除状態で描画される（エラーなし）

- [ ] **Step 2: git 状態を確認**

```bash
git status
git log main..HEAD --oneline
```

Expected: 14 コミット並んでいる

- [ ] **Step 3: draft PR を ready に切り替え、動作確認結果をコメント**

```bash
gh pr ready 50
gh pr comment 50 --body "実装完了。Playwright MCP で以下確認済み:
- デスクトップ右レール ✅
- モバイル節マーカー → Sheet ✅
- 未ログイン fall-back ✅
- 不正 user パラメータの解除 ✅"
```

---

## 自己レビュー結果

- **仕様カバレッジ**: 設計書の各節と対応する task:
  - URL / state → Task 1, 2, 12 (`validateSearch` に `view` / `user` 追加)
  - サークル取得 → Task 5 (`getCircleUserIds`)
  - 章コメンター行 → Task 7 (`ChapterCommentersRow`) + Task 13 統合
  - デスクトップ右レール → Task 9 (`ChapterCommentRail`) + Task 13 統合
  - モバイル Sheet → Task 10 (`VerseCommentSheet`) + Task 11 (`VerseRow` marker) + Task 13 統合
  - CompactPostCard → Task 4
  - AvatarStack → Task 3
  - 未確定事項の 4 決定は Global Constraints セクション + 各 Task に反映
- **プレースホルダ**: 「TODO」「TBD」「後で埋める」は無し
- **型整合**: `AvatarStackItem` が Task 3 で定義 → 各所で再利用、`VerseViewMode = 'count' | 'who'` が Task 1 で定義され Task 6, 8, 12, 13 で参照。loader が返す `view` プロパティも同型
- **フォールバック挙動**: 未ログイン (`userId === null`) 時は `circle === null` になるため `chapterCommenters = []`, `selectedUser = null`, ヘッダーに表示されない。`view === 'who'` かつ `user` 指定でも `latestByUser.has(user)` が false なら `selectedUser = null`（サイレント解除）。すべて Task 12 のロジックでカバー
