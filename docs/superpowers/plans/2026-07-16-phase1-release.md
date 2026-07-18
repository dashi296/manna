# Phase 1 リリース Implementation Plan

> ✅ **完了（2026-07-18）**: 全タスク実装済み。PR #37 で main にマージ。以降の引き継ぎは `docs/superpowers/specs/2026-07-18-phase2-handoff.md` を参照。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1 の残りタスク（フィード画面、投稿詳細、聖典テキスト表示、フォロー、ファミリー、プロフィール、通知、PWA 設定）を実装しリリース可能状態にする

**Architecture:** 既存 FSD 構成を維持。新規 features（follow-user, manage-family）と pages を追加。データ取得はすべて `createServerFn` による SSR。認証状態は `createSupabaseServer()` で cookie から読み取る。

**Tech Stack:** TanStack Start, TypeScript, shadcn/ui, Supabase (PostgreSQL + RLS), Vitest, @testing-library/react, DOMPurify, lucide-react

## Global Constraints

- FSD インポートルール厳守: pages → widgets → features → entities → shared の上→下のみ
- 各 FSD スライスは `index.ts` でパブリック API を公開。外部からは `index.ts` 経由でのみ import
- ブラウザ Supabase: `import { supabase } from '@/shared/lib/supabase'`（`@supabase/ssr` の `createBrowserClient`）
- SSR Supabase: `import { createSupabaseServer } from '@/shared/lib/auth'`
- CSS はデザイントークン（`var(--sea-ink)`, `var(--lagoon-deep)` 等）を使用。Tailwind 直書きの色指定（`text-blue-600` 等）は使わない
- テストは `apps/pwa/tests/` 配下に FSD 構造を反映して配置
- テスト実行: `cd apps/pwa && npx vitest run <path>`
- DB 型: `import type { Database } from '@manna/database'`
- パスエイリアス: `@/` = `apps/pwa/src/`

---

## ファイル構成

```
apps/pwa/src/
├── pages/
│   ├── index.tsx                           # Task 1: フィード画面（スタブ → 実装）
│   ├── posts/$id.tsx                       # Task 2: 投稿詳細画面（新規）
│   ├── scriptures/$collection/$book/$chapter.tsx  # Task 3: 聖典テキスト表示（修正）
│   ├── profile/
│   │   ├── index.tsx                       # Task 6: プロフィール（スタブ → リダイレクト）
│   │   └── $userId.tsx                     # Task 6: プロフィール（新規）
│   ├── notifications.tsx                   # Task 7: 通知画面（スタブ → 実装）
│   └── __root.tsx                          # Task 8: PWA meta 追加（修正）
│
├── features/
│   ├── follow-user/
│   │   ├── ui/FollowButton.tsx             # Task 4: フォロー機能（新規）
│   │   └── index.ts                        # Task 4
│   └── manage-family/
│       ├── ui/FamilyButton.tsx             # Task 5: ファミリー機能（新規）
│       └── index.ts                        # Task 5
│
├── shared/
│   └── ui/
│       └── ScriptureText.tsx               # Task 3: 聖典テキスト表示（新規）
│
└── entities/
    └── post/
        └── ui/PostCard.tsx                 # Task 2: 投稿詳細へのリンク追加（修正）

apps/pwa/tests/
├── features/
│   └── follow-user/
│       └── FollowButton.test.tsx           # Task 4
├── pages/
│   └── feed.test.tsx                       # Task 1
└── shared/
    └── ui/
        └── ScriptureText.test.tsx          # Task 3

apps/pwa/public/
└── manifest.json                           # Task 8: PWA 設定（修正）
```

---

### Task 1: フィード画面

**Files:**
- Modify: `apps/pwa/src/pages/index.tsx`
- Test: `apps/pwa/tests/pages/feed.test.tsx`

**Interfaces:**
- Consumes: `PostCard`, `PostWithUser` from `@/entities/post`; `PostCardSkeleton` from `@/shared/ui`; `createSupabaseServer` from `@/shared/lib/auth`; `PageHeader` from `@/shared/ui`
- Produces: フィードページ `/`。他タスクからの依存なし。

- [ ] **Step 1: フィード画面の失敗テストを書く**

`apps/pwa/tests/pages/feed.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => ({ component: undefined }),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useRouterState: () => ({ location: { pathname: '/' } }),
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: () => vi.fn(),
    }),
  }),
}))

describe('FeedPage', () => {
  it('タブ「全体」と「フォロー中」が表示される', async () => {
    const mod = await import('@/pages/index')
    expect(mod).toBeDefined()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd apps/pwa && npx vitest run tests/pages/feed.test.tsx`
Expected: FAIL（現在の index.tsx はスタブのみ）

- [ ] **Step 3: フィード画面を実装する**

`apps/pwa/src/pages/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { PostCard, type PostWithUser } from '@/entities/post'
import { PostCardSkeleton, PageHeader } from '@/shared/ui'
import { createSupabaseServer } from '@/shared/lib/auth'

const POST_SELECT = `
  id, content, visibility, created_at,
  scripture_collection, scripture_book, scripture_chapter,
  scripture_verses, user_id,
  users ( display_name, avatar_url )
`

const fetchPublicPosts = createServerFn({ method: 'GET' })
  .handler(async () => {
    const serverSupabase = await createSupabaseServer()
    const { data } = await serverSupabase
      .from('posts')
      .select(POST_SELECT)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(20)
    return (data ?? []) as PostWithUser[]
  })

const fetchFollowingPosts = createServerFn({ method: 'GET' })
  .handler(async () => {
    const serverSupabase = await createSupabaseServer()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) return [] as PostWithUser[]
    const { data: following } = await serverSupabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
    const ids = following?.map((f) => f.following_id) ?? []
    if (ids.length === 0) return [] as PostWithUser[]
    const { data } = await serverSupabase
      .from('posts')
      .select(POST_SELECT)
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(20)
    return (data ?? []) as PostWithUser[]
  })

type Tab = 'following' | 'public'

export const Route = createFileRoute('/')({
  loader: async () => {
    const [publicPosts, followingPosts] = await Promise.all([
      fetchPublicPosts(),
      fetchFollowingPosts(),
    ])
    return { publicPosts, followingPosts }
  },
  component: FeedPage,
})

const TABS: { id: Tab; label: string }[] = [
  { id: 'following', label: 'フォロー中' },
  { id: 'public', label: '全体' },
]

function FeedPage() {
  const { publicPosts, followingPosts } = Route.useLoaderData()
  const [tab, setTab] = useState<Tab>('following')

  const posts = tab === 'following' ? followingPosts : publicPosts

  return (
    <div>
      <PageHeader title="Manna" />
      <div className="flex border-b sticky top-0 z-10" style={{ borderColor: 'var(--line)', background: 'var(--header-bg)', backdropFilter: 'blur(8px)' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-3 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: tab === t.id ? 'var(--lagoon-deep)' : 'transparent',
              color: tab === t.id ? 'var(--lagoon-deep)' : 'var(--sea-ink-soft)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {posts.length === 0 ? (
        <div className="p-8 text-center text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
          {tab === 'following'
            ? 'フォロー中のユーザーの投稿はまだありません'
            : '投稿はまだありません'}
        </div>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `cd apps/pwa && npx vitest run tests/pages/feed.test.tsx`
Expected: PASS

- [ ] **Step 5: 開発サーバーで手動確認する**

Run: `cd apps/pwa && pnpm dev`

確認項目:
1. `/` にアクセス → フィードが表示される（ログイン済みの場合）
2. 「フォロー中」/「全体」タブ切り替えが動作する
3. 投稿がある場合 PostCard で表示される
4. 投稿がない場合は空メッセージが表示される

- [ ] **Step 6: コミットする**

```bash
git add apps/pwa/src/pages/index.tsx apps/pwa/tests/pages/feed.test.tsx
git commit -m "feat(feed): フィード画面を実装（全体・フォロー中タブ）"
```

---

### Task 2: 投稿詳細画面

**Files:**
- Create: `apps/pwa/src/pages/posts/$id.tsx`
- Modify: `apps/pwa/src/entities/post/ui/PostCard.tsx`

**Interfaces:**
- Consumes: `PostWithUser` from `@/entities/post`; `MarkdownRenderer`, `PageHeader` from `@/shared/ui`; `createSupabaseServer` from `@/shared/lib/auth`; `getScriptureLabel`, `buildScriptureUrl` from `@/entities/scripture`
- Produces: `/posts/$id` ルート。PostCard に投稿詳細へのリンクを追加。Task 7 の通知画面から `/posts/$id` へリンクする。

- [ ] **Step 1: 投稿詳細画面を作成する**

`apps/pwa/src/pages/posts/$id.tsx`:

```tsx
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { MarkdownRenderer, PageHeader } from '@/shared/ui'
import { createSupabaseServer } from '@/shared/lib/auth'
import { getScriptureLabel, buildScriptureUrl } from '@/entities/scripture'

const POST_SELECT = `
  id, content, visibility, created_at,
  scripture_collection, scripture_book, scripture_chapter,
  scripture_verses, user_id,
  users ( display_name, avatar_url )
`

const fetchPost = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async (ctx) => {
    const serverSupabase = await createSupabaseServer()
    const { data: post } = await serverSupabase
      .from('posts')
      .select(POST_SELECT)
      .eq('id', ctx.data.id)
      .single()
    return post
  })

export const Route = createFileRoute('/posts/$id')({
  loader: async ({ params }) => {
    const post = await fetchPost({ data: { id: params.id } })
    if (!post) throw notFound()
    return { post }
  },
  component: PostDetailPage,
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  })
}

function PostDetailPage() {
  const { post } = Route.useLoaderData()
  const displayName = (post.users as any)?.display_name ?? '匿名ユーザー'
  const avatarUrl = (post.users as any)?.avatar_url as string | null

  const scriptureLabel =
    post.scripture_collection && post.scripture_book && post.scripture_chapter
      ? getScriptureLabel({
          collection: post.scripture_collection,
          book: post.scripture_book,
          chapter: post.scripture_chapter,
          verses: (post.scripture_verses as number[] | null) ?? undefined,
        })
      : null

  const officialUrl =
    post.scripture_collection && post.scripture_book && post.scripture_chapter
      ? buildScriptureUrl({
          collection: post.scripture_collection,
          book: post.scripture_book,
          chapter: post.scripture_chapter,
          verses: (post.scripture_verses as number[] | null) ?? undefined,
        })
      : null

  return (
    <div>
      <PageHeader title="投稿" backTo="/" backLabel="フィード" />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/profile/$userId" params={{ userId: post.user_id }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'var(--lagoon)', color: '#fff' }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
          <div>
            <Link
              to="/profile/$userId"
              params={{ userId: post.user_id }}
              className="font-semibold text-sm hover:underline"
              style={{ color: 'var(--sea-ink)' }}
            >
              {displayName}
            </Link>
            <div className="text-xs" style={{ color: 'var(--sea-ink-soft)' }}>
              {formatDate(post.created_at)}
            </div>
          </div>
        </div>

        {scriptureLabel && officialUrl && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--chip-bg)', border: '1px solid var(--chip-line)' }}>
            <Link
              to="/scriptures/$collection/$book/$chapter"
              params={{
                collection: post.scripture_collection!,
                book: post.scripture_book!,
                chapter: String(post.scripture_chapter!),
              }}
              search={post.scripture_verses ? { verses: post.scripture_verses as number[] } : {}}
              className="font-medium text-sm"
              style={{ color: 'var(--palm)' }}
            >
              📖 {scriptureLabel}
            </Link>
            <div className="mt-1">
              <a
                href={officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
                style={{ color: 'var(--lagoon-deep)' }}
              >
                公式サイトで読む →
              </a>
            </div>
          </div>
        )}

        <MarkdownRenderer content={post.content} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: PostCard に投稿詳細へのリンクを追加する**

`apps/pwa/src/entities/post/ui/PostCard.tsx` に変更を加える。`<article>` タグ全体を `<Link to="/posts/$id">` で囲む。

PostCard.tsx の `<article>` の開始タグを以下に変更:

```tsx
import { Link } from '@tanstack/react-router'
```

を冒頭に追加（既存の import に `Link` を追加）し、`<article>` を以下のように変更:

```tsx
export function PostCard({ post }: Props) {
  // ... 既存の scriptureLabel / scriptureUrl ロジックはそのまま ...

  return (
    <Link
      to="/posts/$id"
      params={{ id: post.id }}
      className="block"
    >
      <article className="px-4 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
        {/* 既存のカード内容はそのまま */}
      </article>
    </Link>
  )
}
```

聖典参照バッジの `<a>` タグはネストリンクになるため、`onClick={(e) => e.stopPropagation()}` を追加して外側の Link への伝播を防ぐ。

- [ ] **Step 3: routeTree を再生成する**

Run: `cd apps/pwa && npx tsr generate`

新しい `/posts/$id` ルートが `routeTree.gen.ts` に追加されることを確認。

- [ ] **Step 4: 開発サーバーで手動確認する**

Run: `cd apps/pwa && pnpm dev`

確認項目:
1. フィードの PostCard をクリック → `/posts/<uuid>` に遷移
2. 投稿者名、日付、聖典参照、Markdown 本文が正しく表示される
3. 聖典参照バッジから聖典ナビゲーターへ遷移できる
4. 「フィード」戻るリンクが動作する
5. 存在しない ID → 404 になる

- [ ] **Step 5: コミットする**

```bash
git add apps/pwa/src/pages/posts/\$id.tsx apps/pwa/src/entities/post/ui/PostCard.tsx apps/pwa/src/routeTree.gen.ts
git commit -m "feat(post-detail): 投稿詳細画面を追加し、PostCardからリンク"
```

---

### Task 3: 聖典テキスト表示

**Files:**
- Create: `apps/pwa/src/shared/ui/ScriptureText.tsx`
- Modify: `apps/pwa/src/shared/ui/index.ts`
- Modify: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`
- Test: `apps/pwa/tests/shared/ui/ScriptureText.test.tsx`

**Interfaces:**
- Consumes: `createSupabaseServer` from `@/shared/lib/auth`
- Produces: `ScriptureText` コンポーネント（`@/shared/ui` からエクスポート）。聖典テキストのサニタイズ表示。

- [ ] **Step 1: DOMPurify をインストールする**

```bash
cd apps/pwa && pnpm add dompurify && pnpm add -D @types/dompurify
```

- [ ] **Step 2: ScriptureText コンポーネントの失敗テストを書く**

`apps/pwa/tests/shared/ui/ScriptureText.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScriptureText } from '@/shared/ui/ScriptureText'

describe('ScriptureText', () => {
  it('節番号とテキストを表示する', () => {
    render(<ScriptureText verse={7} textHtml="わたしに<ruby><rb>尋</rb><rt>たず</rt></ruby>ねなさい" />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('ruby タグを保持し HTML として描画する', () => {
    const { container } = render(
      <ScriptureText verse={1} textHtml="<ruby><rb>善</rb><rt>よ</rt></ruby>い" />
    )
    const ruby = container.querySelector('ruby')
    expect(ruby).not.toBeNull()
  })

  it('危険な HTML タグを除去する', () => {
    const { container } = render(
      <ScriptureText verse={1} textHtml='テスト<script>alert("xss")</script>テキスト' />
    )
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText(/テスト/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `cd apps/pwa && npx vitest run tests/shared/ui/ScriptureText.test.tsx`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 4: ScriptureText コンポーネントを実装する**

`apps/pwa/src/shared/ui/ScriptureText.tsx`:

```tsx
import DOMPurify from 'dompurify'

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['ruby', 'rb', 'rt'],
  ALLOWED_ATTR: [],
}

type Props = {
  verse: number
  textHtml: string
  className?: string
}

export function ScriptureText({ verse, textHtml, className }: Props) {
  const clean = DOMPurify.sanitize(textHtml, PURIFY_CONFIG)

  return (
    <div className={`flex gap-2 py-2 text-sm leading-relaxed ${className ?? ''}`}>
      <span
        className="shrink-0 w-6 text-right text-xs font-medium pt-0.5"
        style={{ color: 'var(--sea-ink-soft)' }}
      >
        {verse}
      </span>
      <span
        style={{ color: 'var(--sea-ink)' }}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    </div>
  )
}
```

- [ ] **Step 5: shared/ui/index.ts にエクスポートを追加する**

`apps/pwa/src/shared/ui/index.ts` に以下を追記:

```typescript
export { ScriptureText } from './ScriptureText'
```

- [ ] **Step 6: テストを実行して通ることを確認する**

Run: `cd apps/pwa && npx vitest run tests/shared/ui/ScriptureText.test.tsx`
Expected: PASS

- [ ] **Step 7: 章ページに聖典テキストを追加する**

`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` を修正する。

まず、`scripture_verses` テーブルからテキストを取得する `createServerFn` を追加する:

```tsx
import { ScriptureText } from '@/shared/ui'

type VerseText = { verse: number; text_html: string }

const fetchVerseTexts = createServerFn({ method: 'POST' })
  .inputValidator((data: { collection: string; book: string; chapter: number; verses?: number[] }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter, verses } = ctx.data
    const serverSupabase = await createSupabaseServer()
    let query = serverSupabase
      .from('scripture_verses')
      .select('verse, text_html')
      .eq('collection_id', collection)
      .eq('book_id', book)
      .eq('chapter', chapter)
      .order('verse', { ascending: true })
    if (verses?.length) {
      query = query.in('verse', verses)
    }
    const { data } = await query
    return (data ?? []) as VerseText[]
  })
```

次に、`loader` の両方のブランチ（chapter モードと verse モード）で `fetchVerseTexts` を呼び出し、返り値に `verseTexts` を追加する:

**verse モード（`if (deps.verses?.length)`）** 内:

```tsx
const [posts, verseTexts] = await Promise.all([
  fetchVersePosts({ data: { collection: params.collection, book: params.book, chapter: chapterNum, verses: deps.verses } }),
  fetchVerseTexts({ data: { collection: params.collection, book: params.book, chapter: chapterNum, verses: deps.verses } }),
])
return {
  book, chapter: chapterNum, collection: params.collection,
  mode: 'verse' as const, verses: deps.verses,
  posts, countByVerse: {} as Record<number, number>,
  verseTexts,
}
```

**chapter モード** 内:

```tsx
const [countByVerse, verseTexts] = await Promise.all([
  fetchChapterCounts({ data: { collection: params.collection, book: params.book, chapter: chapterNum } }),
  fetchVerseTexts({ data: { collection: params.collection, book: params.book, chapter: chapterNum } }),
])
return {
  book, chapter: chapterNum, collection: params.collection,
  mode: 'chapter' as const, verses: [] as number[],
  posts: [] as PostWithUser[], countByVerse,
  verseTexts,
}
```

**verse モードの UI** に聖典テキストを投稿一覧の上に表示:

「公式サイトで読む →」リンクの下に:

```tsx
{verseTexts.length > 0 && (
  <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
    {verseTexts.map((vt) => (
      <ScriptureText key={vt.verse} verse={vt.verse} textHtml={vt.text_html} />
    ))}
  </div>
)}
```

**chapter モードの UI** の節一覧で各節のテキストを表示:

既存の `<span className="text-sm">第{verse}節</span>` を、`verseTexts` からテキストを取得して表示する形に変更:

```tsx
{Array.from({ length: book.verses[chapter - 1] }, (_, i) => i + 1).map((verse) => {
  const count = countByVerse[verse] ?? 0
  const vt = verseTexts.find((t) => t.verse === verse)
  return (
    <li key={verse} className="border-b last:border-b-0" style={{ borderColor: 'var(--line)' }}>
      <Link
        to="/scriptures/$collection/$book/$chapter"
        params={{ collection, book: book.id, chapter: String(chapter) }}
        search={{ verses: [verse] }}
        className="flex items-start justify-between gap-2 px-4 py-3 transition-colors"
        style={{ color: 'var(--sea-ink)' }}
      >
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium" style={{ color: 'var(--sea-ink-soft)' }}>
            {verse}
          </span>
          {vt && (
            <span
              className="ml-2 text-sm"
              style={{ color: 'var(--sea-ink)' }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(vt.text_html, { ALLOWED_TAGS: ['ruby', 'rb', 'rt'], ALLOWED_ATTR: [] }) }}
            />
          )}
        </div>
        {count > 0 && (
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
        )}
      </Link>
    </li>
  )
})}
```

章ページの `import` に `DOMPurify` を追加:

```tsx
import DOMPurify from 'dompurify'
```

- [ ] **Step 8: 開発サーバーで手動確認する**

Run: `cd apps/pwa && pnpm dev`

確認項目:
1. `/scriptures/bofm/1-ne/3` → 各節のテキストが ruby 付きで表示される
2. `/scriptures/bofm/1-ne/3?verses=7` → 第7節のテキストが投稿一覧の上に表示される
3. ruby（ルビ）が漢字の上に正しく表示される
4. `<script>` 等の危険タグが除去されている

- [ ] **Step 9: コミットする**

```bash
git add apps/pwa/src/shared/ui/ScriptureText.tsx apps/pwa/src/shared/ui/index.ts apps/pwa/src/pages/scriptures/\$collection/\$book/\$chapter.tsx apps/pwa/tests/shared/ui/ScriptureText.test.tsx
git commit -m "feat(scripture): 聖典テキストをアプリ内表示（DOMPurify でサニタイズ）"
```

---

### Task 4: フォロー機能

**Files:**
- Create: `apps/pwa/src/features/follow-user/ui/FollowButton.tsx`
- Create: `apps/pwa/src/features/follow-user/index.ts`
- Test: `apps/pwa/tests/features/follow-user/FollowButton.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `@/shared/lib/supabase`
- Produces: `FollowButton` コンポーネント。Props: `{ targetUserId: string; currentUserId: string; initialFollowing: boolean }`。Task 6 プロフィール画面で使用。

- [ ] **Step 1: FollowButton の失敗テストを書く**

`apps/pwa/tests/features/follow-user/FollowButton.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FollowButton } from '@/features/follow-user'

const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockDelete = vi.fn(() => ({
  eq: vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })),
}))

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      delete: mockDelete,
    }),
  },
}))

describe('FollowButton', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockDelete.mockClear()
  })

  it('未フォロー時に「フォロー」ボタンを表示する', () => {
    render(<FollowButton targetUserId="u2" currentUserId="u1" initialFollowing={false} />)
    expect(screen.getByRole('button', { name: 'フォロー' })).toBeInTheDocument()
  })

  it('フォロー済み時に「フォロー中」ボタンを表示する', () => {
    render(<FollowButton targetUserId="u2" currentUserId="u1" initialFollowing={true} />)
    expect(screen.getByRole('button', { name: 'フォロー中' })).toBeInTheDocument()
  })

  it('クリックでフォロー→フォロー中に切り替わる', async () => {
    render(<FollowButton targetUserId="u2" currentUserId="u1" initialFollowing={false} />)
    await userEvent.click(screen.getByRole('button', { name: 'フォロー' }))
    expect(await screen.findByRole('button', { name: 'フォロー中' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `cd apps/pwa && npx vitest run tests/features/follow-user/FollowButton.test.tsx`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: FollowButton を実装する**

`apps/pwa/src/features/follow-user/ui/FollowButton.tsx`:

```tsx
import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { supabase } from '@/shared/lib/supabase'

type Props = {
  targetUserId: string
  currentUserId: string
  initialFollowing: boolean
}

export function FollowButton({ targetUserId, currentUserId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, setPending] = useState(false)

  const toggle = async () => {
    if (pending) return
    setPending(true)
    if (following) {
      await supabase.from('follows').delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId)
      setFollowing(false)
    } else {
      await supabase.from('follows').insert({
        follower_id: currentUserId,
        following_id: targetUserId,
      })
      setFollowing(true)
    }
    setPending(false)
  }

  return (
    <Button
      onClick={toggle}
      disabled={pending}
      variant={following ? 'outline' : 'default'}
      size="sm"
    >
      {following ? 'フォロー中' : 'フォロー'}
    </Button>
  )
}
```

- [ ] **Step 4: index.ts を作成する**

`apps/pwa/src/features/follow-user/index.ts`:

```typescript
export { FollowButton } from './ui/FollowButton'
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `cd apps/pwa && npx vitest run tests/features/follow-user/FollowButton.test.tsx`
Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add apps/pwa/src/features/follow-user/ apps/pwa/tests/features/follow-user/
git commit -m "feat(follow): FollowButton コンポーネントを TDD で実装"
```

---

### Task 5: ファミリー機能

**Files:**
- Create: `apps/pwa/src/features/manage-family/ui/FamilyButton.tsx`
- Create: `apps/pwa/src/features/manage-family/index.ts`

**Interfaces:**
- Consumes: `supabase` from `@/shared/lib/supabase`
- Produces: `FamilyButton` コンポーネント。Props: `{ targetUserId: string; currentUserId: string; initialStatus: FamilyStatus }`、`FamilyStatus` 型。Task 6 プロフィール画面で使用。

- [ ] **Step 1: FamilyButton を実装する**

`apps/pwa/src/features/manage-family/ui/FamilyButton.tsx`:

```tsx
import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { supabase } from '@/shared/lib/supabase'

export type FamilyStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted'

type Props = {
  targetUserId: string
  currentUserId: string
  initialStatus: FamilyStatus
}

export function FamilyButton({ targetUserId, currentUserId, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [pending, setPending] = useState(false)

  const sendRequest = async () => {
    setPending(true)
    const { error } = await supabase.from('family_relationships').insert({
      requester_id: currentUserId,
      addressee_id: targetUserId,
    })
    if (!error) setStatus('pending_sent')
    setPending(false)
  }

  const accept = async () => {
    setPending(true)
    const { error } = await supabase.from('family_relationships')
      .update({ status: 'accepted' })
      .eq('requester_id', targetUserId)
      .eq('addressee_id', currentUserId)
    if (!error) setStatus('accepted')
    setPending(false)
  }

  const remove = async () => {
    setPending(true)
    await supabase.from('family_relationships').delete()
      .or(
        `and(requester_id.eq.${currentUserId},addressee_id.eq.${targetUserId}),` +
        `and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`
      )
    setStatus('none')
    setPending(false)
  }

  if (status === 'accepted') {
    return (
      <Button onClick={remove} disabled={pending} variant="outline" size="sm">
        ファミリー
      </Button>
    )
  }

  if (status === 'pending_sent') {
    return (
      <Button disabled variant="outline" size="sm">
        招待送信済み
      </Button>
    )
  }

  if (status === 'pending_received') {
    return (
      <Button onClick={accept} disabled={pending} size="sm">
        招待を承認
      </Button>
    )
  }

  return (
    <Button onClick={sendRequest} disabled={pending} variant="outline" size="sm">
      ファミリーに追加
    </Button>
  )
}
```

- [ ] **Step 2: index.ts を作成する**

`apps/pwa/src/features/manage-family/index.ts`:

```typescript
export type { FamilyStatus } from './ui/FamilyButton'
export { FamilyButton } from './ui/FamilyButton'
```

- [ ] **Step 3: コミットする**

```bash
git add apps/pwa/src/features/manage-family/
git commit -m "feat(family): FamilyButton コンポーネントを実装"
```

---

### Task 6: プロフィール画面

**Files:**
- Modify: `apps/pwa/src/pages/profile/index.tsx`
- Create: `apps/pwa/src/pages/profile/$userId.tsx`

**Interfaces:**
- Consumes: `PostCard`, `PostWithUser` from `@/entities/post`; `FollowButton` from `@/features/follow-user`; `FamilyButton`, `FamilyStatus` from `@/features/manage-family`; `PageHeader` from `@/shared/ui`; `createSupabaseServer` from `@/shared/lib/auth`
- Produces: `/profile` ルート（リダイレクト）、`/profile/$userId` ルート。

- [ ] **Step 1: /profile リダイレクトを実装する**

`apps/pwa/src/pages/profile/index.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { createSupabaseServer } from '@/shared/lib/auth'

const getCurrentUserId = createServerFn({ method: 'GET' })
  .handler(async () => {
    const serverSupabase = await createSupabaseServer()
    const { data: { user } } = await serverSupabase.auth.getUser()
    return user?.id ?? null
  })

export const Route = createFileRoute('/profile/')({
  loader: async () => {
    const userId = await getCurrentUserId()
    if (!userId) throw redirect({ to: '/login' })
    throw redirect({ to: '/profile/$userId', params: { userId } })
  },
  component: () => null,
})
```

- [ ] **Step 2: /profile/$userId を実装する**

`apps/pwa/src/pages/profile/$userId.tsx`:

```tsx
import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { PostCard, type PostWithUser } from '@/entities/post'
import { FollowButton } from '@/features/follow-user'
import { FamilyButton, type FamilyStatus } from '@/features/manage-family'
import { PageHeader } from '@/shared/ui'
import { createSupabaseServer } from '@/shared/lib/auth'

const POST_SELECT = `
  id, content, visibility, created_at,
  scripture_collection, scripture_book, scripture_chapter,
  scripture_verses, user_id,
  users ( display_name, avatar_url )
`

const fetchProfileData = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string }) => data)
  .handler(async (ctx) => {
    const { userId } = ctx.data
    const serverSupabase = await createSupabaseServer()

    const [
      { data: profile },
      { data: { user: currentUser } },
      { data: posts },
      { count: followerCount },
      { count: followingCount },
    ] = await Promise.all([
      serverSupabase.from('users').select('*').eq('id', userId).single(),
      serverSupabase.auth.getUser(),
      serverSupabase.from('posts').select(POST_SELECT).eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
      serverSupabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      serverSupabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ])

    if (!profile) return null

    const isOwn = currentUser?.id === userId
    let isFollowing = false
    let familyStatus: FamilyStatus = 'none'

    if (currentUser && !isOwn) {
      const [{ data: followData }, { data: familyData }] = await Promise.all([
        serverSupabase.from('follows').select('follower_id').eq('follower_id', currentUser.id).eq('following_id', userId).maybeSingle(),
        serverSupabase.from('family_relationships').select('*')
          .or(
            `and(requester_id.eq.${currentUser.id},addressee_id.eq.${userId}),` +
            `and(requester_id.eq.${userId},addressee_id.eq.${currentUser.id})`
          )
          .maybeSingle(),
      ])
      isFollowing = !!followData
      if (familyData) {
        if (familyData.status === 'accepted') familyStatus = 'accepted'
        else if (familyData.requester_id === currentUser.id) familyStatus = 'pending_sent'
        else familyStatus = 'pending_received'
      }
    }

    return {
      profile,
      posts: (posts ?? []) as PostWithUser[],
      currentUserId: currentUser?.id ?? null,
      isOwn,
      isFollowing,
      familyStatus,
      followerCount: followerCount ?? 0,
      followingCount: followingCount ?? 0,
    }
  })

export const Route = createFileRoute('/profile/$userId')({
  loader: async ({ params }) => {
    const data = await fetchProfileData({ data: { userId: params.userId } })
    if (!data) throw notFound()
    return data
  },
  component: ProfilePage,
})

function ProfilePage() {
  const {
    profile, posts, currentUserId, isOwn,
    isFollowing, familyStatus, followerCount, followingCount,
  } = Route.useLoaderData()

  const displayName = profile.display_name ?? '匿名ユーザー'
  const avatarUrl = profile.avatar_url as string | null

  return (
    <div>
      <PageHeader title={displayName} backTo="/" backLabel="フィード" />
      <div className="p-4 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-start gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-16 h-16 rounded-full object-cover shrink-0" />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
              style={{ background: 'var(--lagoon)', color: '#fff' }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--sea-ink)' }}>
              {displayName}
            </h2>
            {profile.bio && (
              <p className="text-sm mt-1" style={{ color: 'var(--sea-ink-soft)' }}>
                {profile.bio}
              </p>
            )}
            <div className="flex gap-4 mt-2 text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
              <span>
                <strong style={{ color: 'var(--sea-ink)' }}>{followerCount}</strong> フォロワー
              </span>
              <span>
                <strong style={{ color: 'var(--sea-ink)' }}>{followingCount}</strong> フォロー中
              </span>
            </div>
          </div>
        </div>
        {!isOwn && currentUserId && (
          <div className="flex gap-2 mt-3">
            <FollowButton targetUserId={profile.id} currentUserId={currentUserId} initialFollowing={isFollowing} />
            <FamilyButton targetUserId={profile.id} currentUserId={currentUserId} initialStatus={familyStatus} />
          </div>
        )}
      </div>
      <div>
        {posts.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
            投稿はまだありません
          </div>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: routeTree を再生成する**

Run: `cd apps/pwa && npx tsr generate`

`/profile/$userId` ルートが `routeTree.gen.ts` に追加されることを確認。

- [ ] **Step 4: 開発サーバーで手動確認する**

Run: `cd apps/pwa && pnpm dev`

確認項目:
1. `/profile` → 自分のプロフィールにリダイレクト
2. Avatar、名前、フォロワー数が表示される
3. 他ユーザーの場合、FollowButton と FamilyButton が表示される
4. FollowButton をクリック → フォロー/解除が切り替わる
5. FamilyButton をクリック → 招待が送信される
6. 投稿一覧が表示される

- [ ] **Step 5: コミットする**

```bash
git add apps/pwa/src/pages/profile/ apps/pwa/src/routeTree.gen.ts
git commit -m "feat(profile): プロフィール画面を実装（フォロー・ファミリー連携）"
```

---

### Task 7: 通知画面

**Files:**
- Modify: `apps/pwa/src/pages/notifications.tsx`

**Interfaces:**
- Consumes: `PageHeader` from `@/shared/ui`; `createSupabaseServer` from `@/shared/lib/auth`
- Produces: `/notifications` ルート。

- [ ] **Step 1: 通知画面を実装する**

`apps/pwa/src/pages/notifications.tsx`:

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { PageHeader } from '@/shared/ui'
import { createSupabaseServer } from '@/shared/lib/auth'
import { supabase } from '@/shared/lib/supabase'
import { useEffect } from 'react'

type NotificationRow = {
  id: string
  type: 'liked' | 'followed' | 'family_requested' | 'family_accepted'
  read: boolean
  created_at: string
  post_id: string | null
  actor_id: string
  users: { display_name: string | null; avatar_url: string | null } | null
}

const LABELS: Record<NotificationRow['type'], string> = {
  liked: 'があなたの投稿にいいねしました',
  followed: 'があなたをフォローしました',
  family_requested: 'がファミリーに招待しました',
  family_accepted: 'がファミリー招待を承認しました',
}

const fetchNotifications = createServerFn({ method: 'GET' })
  .handler(async () => {
    const serverSupabase = await createSupabaseServer()
    const { data } = await serverSupabase
      .from('notifications')
      .select('id, type, read, created_at, post_id, actor_id, users:actor_id ( display_name, avatar_url )')
      .order('created_at', { ascending: false })
      .limit(50)
    return (data ?? []) as NotificationRow[]
  })

export const Route = createFileRoute('/notifications')({
  loader: () => fetchNotifications(),
  component: NotificationsPage,
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  })
}

function NotificationsPage() {
  const notifications = Route.useLoaderData()

  useEffect(() => {
    supabase.from('notifications').update({ read: true }).eq('read', false).then(() => {})
  }, [])

  return (
    <div>
      <PageHeader title="通知" />
      {notifications.length === 0 ? (
        <div className="p-8 text-center text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
          通知はまだありません
        </div>
      ) : (
        <ul>
          {notifications.map((n) => {
            const actorName = n.users?.display_name ?? '匿名ユーザー'
            const avatarUrl = n.users?.avatar_url as string | null
            return (
              <li
                key={n.id}
                className="flex items-start gap-3 px-4 py-3 border-b"
                style={{
                  borderColor: 'var(--line)',
                  background: n.read ? 'transparent' : 'var(--chip-bg)',
                }}
              >
                <Link to="/profile/$userId" params={{ userId: n.actor_id }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={actorName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: 'var(--lagoon)', color: '#fff' }}
                    >
                      {actorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--sea-ink)' }}>
                    <Link
                      to="/profile/$userId"
                      params={{ userId: n.actor_id }}
                      className="font-semibold hover:underline"
                    >
                      {actorName}
                    </Link>
                    <span style={{ color: 'var(--sea-ink-soft)' }}>{LABELS[n.type]}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <time className="text-xs" style={{ color: 'var(--sea-ink-soft)' }}>
                      {formatDate(n.created_at)}
                    </time>
                    {n.post_id && (
                      <Link
                        to="/posts/$id"
                        params={{ id: n.post_id }}
                        className="text-xs underline"
                        style={{ color: 'var(--lagoon-deep)' }}
                      >
                        投稿を見る
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 開発サーバーで手動確認する**

Run: `cd apps/pwa && pnpm dev`

確認項目:
1. `/notifications` にアクセス → 通知一覧が表示される
2. フォロー通知の Actor 名とメッセージが正しい
3. 未読通知が背景色で区別される
4. 「投稿を見る」リンクが投稿詳細へ遷移する
5. Actor の Avatar クリックでプロフィールへ遷移する

- [ ] **Step 3: コミットする**

```bash
git add apps/pwa/src/pages/notifications.tsx
git commit -m "feat(notifications): 通知画面を実装"
```

---

### Task 8: PWA 設定

**Files:**
- Modify: `apps/pwa/public/manifest.json`
- Modify: `apps/pwa/src/pages/__root.tsx`

**Interfaces:**
- Consumes: なし
- Produces: PWA マニフェスト設定。

- [ ] **Step 1: manifest.json を更新する**

`apps/pwa/public/manifest.json`:

```json
{
  "name": "Manna — 聖典学習共有",
  "short_name": "Manna",
  "description": "聖典学習の体験と感想を分かち合う",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f6f3ee",
  "theme_color": "#2b7a72",
  "lang": "ja",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    },
    {
      "src": "logo192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "logo512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ]
}
```

`background_color` はデザイントークン `--foam` に合わせる。`theme_color` は `--lagoon-deep` に合わせる。

- [ ] **Step 2: __root.tsx に PWA meta タグを追加する**

`apps/pwa/src/pages/__root.tsx` の `head` 関数内の `meta` 配列に以下を追加:

```tsx
head: () => ({
  meta: [
    { charSet: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { title: 'Manna' },
    { name: 'theme-color', content: '#2b7a72' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'description', content: '聖典学習の体験と感想を分かち合う' },
  ],
  links: [
    { rel: 'stylesheet', href: appCss },
    { rel: 'manifest', href: '/manifest.json' },
    { rel: 'apple-touch-icon', href: '/logo192.png' },
  ],
}),
```

- [ ] **Step 3: ビルドして確認する**

Run: `cd apps/pwa && pnpm build`

Expected: エラーなし。

- [ ] **Step 4: 開発サーバーで PWA 確認する**

Run: `cd apps/pwa && pnpm dev`

Chrome DevTools → Application → Manifest でマニフェストが読み込まれ、アイコンが表示されることを確認。

- [ ] **Step 5: コミットする**

```bash
git add apps/pwa/public/manifest.json apps/pwa/src/pages/__root.tsx
git commit -m "feat(pwa): PWA マニフェストと meta タグを設定"
```

---

### Task 9: 全体テスト + ビルド確認

**Files:** なし（既存コードのテスト・確認のみ）

**Interfaces:**
- Consumes: 全タスクの成果物
- Produces: リリース可能な状態の確認

- [ ] **Step 1: 全テストを実行する**

Run: `cd apps/pwa && npx vitest run`
Expected: すべて PASS

- [ ] **Step 2: TypeScript 型チェックを実行する**

Run: `cd apps/pwa && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: プロダクションビルドを確認する**

Run: `cd apps/pwa && pnpm build`
Expected: エラーなし

- [ ] **Step 4: 全画面の動作チェックリスト**

Run: `cd apps/pwa && pnpm dev`

- [ ] ログイン → `/login` からサインイン → `/` にリダイレクト
- [ ] フィード → 「全体」タブで公開投稿が表示される
- [ ] フィード → 「フォロー中」タブが動作する
- [ ] 投稿作成 → `/posts/new` でMarkdown入力 + 聖典参照 + 公開範囲 → 投稿成功
- [ ] 投稿詳細 → PostCard クリック → 詳細画面
- [ ] 聖典ナビゲーター → `/scriptures` → コレクション → 書 → 章 → 節テキスト表示
- [ ] 聖典テキスト → 節ページで ruby 付きテキスト表示
- [ ] プロフィール → `/profile` → 自分のプロフィール（Avatar、投稿、フォロー数）
- [ ] フォロー → 他ユーザープロフィールでフォロー/解除
- [ ] ファミリー → 招待送信/承認/解除
- [ ] 通知 → フォロー通知、ファミリー通知が表示、既読に更新される
- [ ] PWA → マニフェストが読み込まれる
- [ ] モバイル → BottomNav が正しく表示される
- [ ] サイドバー → デスクトップで AppSidebar が正しく表示される

- [ ] **Step 5: コミットする（修正があった場合のみ）**

```bash
git add -A
git commit -m "fix: 全体テスト + ビルド確認で発見した問題を修正"
```
