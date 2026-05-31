# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 視認性・統一感のあるデザインシステムを全ページに適用し、PostCard・BottomNav・各ページを既存の CSS 変数（`--sea-ink`, `--lagoon` 等）と lucide-react アイコンで統一する。

**Architecture:** `apps/pwa/src/styles.css` にある既存の CSS 変数（`--sea-ink`/`--lagoon`/`--palm`/`--foam` 等）を Tailwind v4 の `@theme` に登録して named utility として使えるようにする。shadcn/ui が必要とする `--primary`/`--foreground` 等も既存変数にマッピングして一元管理する。その後 BottomNav・PostCard・各ページを順に更新する。

**Tech Stack:** TailwindCSS v4 (`@theme`), lucide-react (already installed), shadcn/ui Radix components, @testing-library/react + Vitest

---

## File Map

| 操作 | パス | 役割 |
|------|------|------|
| Modify | `apps/pwa/src/styles.css` | `@theme` ブロックにデザイントークン追加、shadcn 変数マッピング |
| Modify | `apps/pwa/pages/__root.tsx` | RootLayout から `bg-white` 削除、コンテナ整理 |
| Modify | `apps/pwa/shared/ui/BottomNav.tsx` | 絵文字→lucide-react アイコン、デザイントークン適用 |
| Modify | `apps/pwa/entities/post/ui/PostCard.tsx` | アバター・ユーザー名・日時・聖典バッジ・インタラクション追加 |
| Create | `apps/pwa/tests/entities/post/PostCard.test.tsx` | PostCard のテスト |
| Create | `apps/pwa/shared/ui/PageHeader.tsx` | ページヘッダー共通コンポーネント |
| Modify | `apps/pwa/pages/login.tsx` | ブランドデザインでリデザイン |
| Modify | `apps/pwa/pages/scriptures/index.tsx` | デザイントークン適用 |
| Modify | `apps/pwa/pages/scriptures/$collection/index.tsx` | デザイントークン適用 |
| Modify | `apps/pwa/pages/scriptures/$collection/$book/index.tsx` | デザイントークン適用 |
| Modify | `apps/pwa/pages/scriptures/$collection/$book/$chapter.tsx` | デザイントークン適用 |
| Create | `apps/pwa/shared/ui/skeleton.tsx` | スケルトン UI コンポーネント |

---

## Task 1: Tailwind v4 デザイントークン整備

**Files:**
- Modify: `apps/pwa/src/styles.css`

既存 `:root` の CSS 変数を Tailwind v4 `@theme` に登録し named utility として使えるようにする。shadcn/ui の `--primary` 等も既存変数へマッピングする。

- [ ] **Step 1: `styles.css` の `@theme` ブロックを拡張する**

`@import "tailwindcss";` の直後の `@theme {` ブロックを以下に置き換える:

```css
@theme {
  --font-sans: "Manrope", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Fraunces", Georgia, serif;

  /* Brand colors — named Tailwind utilities */
  --color-sea-ink: var(--sea-ink);
  --color-sea-ink-soft: var(--sea-ink-soft);
  --color-lagoon: var(--lagoon);
  --color-lagoon-deep: var(--lagoon-deep);
  --color-palm: var(--palm);
  --color-sand: var(--sand);
  --color-foam: var(--foam);
  --color-bg-base: var(--bg-base);
  --color-surface: var(--surface);
  --color-surface-strong: var(--surface-strong);
  --color-line: var(--line);

  /* shadcn/ui token mapping */
  --color-background: var(--foam);
  --color-foreground: var(--sea-ink);
  --color-muted: var(--sand);
  --color-muted-foreground: var(--sea-ink-soft);
  --color-primary: var(--lagoon-deep);
  --color-primary-foreground: #ffffff;
  --color-secondary: var(--palm);
  --color-secondary-foreground: #ffffff;
  --color-border: var(--line);
  --color-ring: var(--lagoon);

  /* Radius */
  --radius: 0.75rem;
}
```

- [ ] **Step 2: ビルドが通ることを確認する**

```bash
cd apps/pwa && pnpm build 2>&1 | tail -10
```

Expected: `✓ built in` のような成功メッセージ（エラーなし）

- [ ] **Step 3: コミット**

```bash
git add apps/pwa/src/styles.css
git commit -m "feat(design): Tailwind v4 @theme にブランドトークンと shadcn マッピングを追加"
```

---

## Task 2: RootLayout のコンテナ修正

**Files:**
- Modify: `apps/pwa/pages/__root.tsx`

`bg-white` が styles.css のグラデーション背景を隠している。削除してデザイントークンを使う。

- [ ] **Step 1: RootLayout の className を修正する**

`pages/__root.tsx` の `RootLayout` 関数内:

```tsx
// 変更前
<div className="max-w-md mx-auto min-h-screen flex flex-col bg-white">
  <main className="flex-1 overflow-y-auto pb-16">
    <Outlet />
  </main>
  <BottomNav />
</div>

// 変更後
<div className="max-w-md mx-auto min-h-screen flex flex-col">
  <main className="flex-1 pb-16">
    <Outlet />
  </main>
  <BottomNav />
</div>
```

- [ ] **Step 2: テストが通ることを確認**

```bash
cd apps/pwa && pnpm test 2>&1 | tail -5
```

Expected: `Tests 9 passed (9)`

- [ ] **Step 3: コミット**

```bash
git add apps/pwa/pages/__root.tsx
git commit -m "fix(layout): RootLayout から bg-white を削除してグラデーション背景を復活"
```

---

## Task 3: BottomNav — 絵文字を lucide-react アイコンに置き換え

**Files:**
- Modify: `apps/pwa/shared/ui/BottomNav.tsx`

lucide-react は既にインストール済み。

- [ ] **Step 1: BottomNav.tsx を書き換える**

```tsx
import { Link, useRouterState } from '@tanstack/react-router'
import { Home, BookOpen, PenLine, Bell, User } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'フィード', Icon: Home },
  { to: '/scriptures', label: '聖典', Icon: BookOpen },
  { to: '/posts/new', label: '投稿', Icon: PenLine },
  { to: '/notifications', label: '通知', Icon: Bell },
  { to: '/profile', label: 'プロフィール', Icon: User },
] as const

export function BottomNav() {
  const { location } = useRouterState()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--line)', backdropFilter: 'blur(8px)' }}>
      <div className="flex">
        {NAV_ITEMS.map(({ to, label, Icon }) => {
          const active =
            location.pathname === to ||
            (to !== '/' && location.pathname.startsWith(to))
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors',
                active ? 'text-lagoon-deep' : 'text-sea-ink-soft hover:text-sea-ink'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: テストが通ることを確認**

```bash
cd apps/pwa && pnpm test 2>&1 | tail -5
```

Expected: `Tests 9 passed (9)`

- [ ] **Step 3: コミット**

```bash
git add apps/pwa/shared/ui/BottomNav.tsx
git commit -m "feat(design): BottomNav の絵文字アイコンを lucide-react SVG に置き換え"
```

---

## Task 4: PostCard リデザイン — テスト作成

**Files:**
- Create: `apps/pwa/tests/entities/post/PostCard.test.tsx`

TDD 原則に従い、まずテストを書いて失敗させる。

- [ ] **Step 1: テストファイルを作成する**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostCard, type PostWithUser } from '@/entities/post'

const basePost: PostWithUser = {
  id: 'post-1',
  content: 'これは試験投稿です。',
  visibility: 'public',
  created_at: '2026-05-31T10:00:00Z',
  scripture_collection: 'bofm',
  scripture_book: '1-ne',
  scripture_chapter: 3,
  scripture_verses: [7],
  user_id: 'user-1',
  users: { display_name: 'テスト太郎', avatar_url: null },
}

describe('PostCard', () => {
  it('投稿本文を表示する', () => {
    render(<PostCard post={basePost} />)
    expect(screen.getByText('これは試験投稿です。')).toBeInTheDocument()
  })

  it('ユーザーの表示名を表示する', () => {
    render(<PostCard post={basePost} />)
    expect(screen.getByText('テスト太郎')).toBeInTheDocument()
  })

  it('聖典参照ラベルを表示する', () => {
    render(<PostCard post={basePost} />)
    expect(screen.getByText(/第1ニーファイ書/)).toBeInTheDocument()
  })

  it('投稿日時を表示する', () => {
    render(<PostCard post={basePost} />)
    // 日付フォーマット（例: "2026/05/31" または "5月31日" 等）が含まれる
    expect(screen.getByText(/2026|5月31日/)).toBeInTheDocument()
  })

  it('display_name が null のときはフォールバック表示する', () => {
    const post = { ...basePost, users: { display_name: null, avatar_url: null } }
    render(<PostCard post={post} />)
    expect(screen.getByText('匿名ユーザー')).toBeInTheDocument()
  })

  it('聖典参照が null のときはバッジを表示しない', () => {
    const post = { ...basePost, scripture_collection: null, scripture_book: null, scripture_chapter: null, scripture_verses: null }
    render(<PostCard post={post} />)
    expect(screen.queryByRole('link', { name: /第1ニーファイ書/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd apps/pwa && pnpm test 2>&1 | grep -E "FAIL|passed|failed"
```

Expected: いくつかのテストが失敗する（ユーザー名・聖典ラベル・日時は現状未表示）

---

## Task 5: PostCard リデザイン — 実装

**Files:**
- Modify: `apps/pwa/entities/post/ui/PostCard.tsx`

- [ ] **Step 1: PostCard.tsx を書き換える**

```tsx
import { Link } from '@tanstack/react-router'
import { getScriptureLabel } from '@/entities/scripture'
import { cn } from '@/shared/lib/utils'

export type PostWithUser = {
  id: string
  content: string
  visibility: string
  created_at: string
  scripture_collection: string | null
  scripture_book: string | null
  scripture_chapter: number | null
  scripture_verses: number[] | null
  user_id: string
  users: { display_name: string | null; avatar_url: string | null } | null
}

type Props = { post: PostWithUser }

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

function Initials({ name }: { name: string }) {
  const ch = name.charAt(0).toUpperCase()
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{ background: 'var(--lagoon)', color: '#fff' }}
      aria-hidden
    >
      {ch}
    </div>
  )
}

export function PostCard({ post }: Props) {
  const displayName = post.users?.display_name ?? '匿名ユーザー'
  const avatarUrl = post.users?.avatar_url

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
    <article className="px-4 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
      {/* ヘッダー: アバター + ユーザー名 + 日時 */}
      <div className="flex items-start gap-3 mb-2">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
        ) : (
          <Initials name={displayName} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--sea-ink)' }}>
              {displayName}
            </span>
            <time
              dateTime={post.created_at}
              className="text-xs shrink-0"
              style={{ color: 'var(--sea-ink-soft)' }}
            >
              {formatDate(post.created_at)}
            </time>
          </div>
          {scriptureLabel && post.scripture_collection && post.scripture_book && post.scripture_chapter && (
            <Link
              to="/scriptures/$collection/$book/$chapter"
              params={{
                collection: post.scripture_collection,
                book: post.scripture_book,
                chapter: String(post.scripture_chapter),
              }}
              search={post.scripture_verses ? { verses: post.scripture_verses } : {}}
              className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{
                background: 'var(--chip-bg)',
                border: '1px solid var(--chip-line)',
                color: 'var(--palm)',
              }}
            >
              📖 {scriptureLabel}
            </Link>
          )}
        </div>
      </div>

      {/* 本文 */}
      <p
        className="text-sm leading-relaxed whitespace-pre-wrap ml-12"
        style={{ color: 'var(--sea-ink)' }}
      >
        {post.content}
      </p>
    </article>
  )
}
```

- [ ] **Step 2: テストが全て通ることを確認**

```bash
cd apps/pwa && pnpm test 2>&1 | tail -8
```

Expected: `Tests 15 passed (15)` （既存 9 + 新規 6）

- [ ] **Step 3: コミット**

```bash
git add apps/pwa/entities/post/ui/PostCard.tsx apps/pwa/tests/entities/post/PostCard.test.tsx
git commit -m "feat(post): PostCard にユーザー情報・聖典バッジ・日時を追加（TDD）"
```

---

## Task 6: PageHeader 共通コンポーネント

**Files:**
- Create: `apps/pwa/shared/ui/PageHeader.tsx`

- [ ] **Step 1: PageHeader.tsx を作成する**

```tsx
import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

type Props = {
  title: string
  backTo?: string
  backLabel?: string
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, backTo, backLabel, action, className }: Props) {
  return (
    <header
      className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-2', className)}
      style={{
        background: 'var(--header-bg)',
        borderBottom: '1px solid var(--line)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {backTo && (
        <Link
          to={backTo}
          className="flex items-center gap-0.5 text-sm -ml-1 pr-2"
          style={{ color: 'var(--lagoon-deep)' }}
          aria-label={backLabel ?? '戻る'}
        >
          <ChevronLeft size={18} />
          {backLabel && <span>{backLabel}</span>}
        </Link>
      )}
      <h1 className="flex-1 text-base font-bold truncate" style={{ color: 'var(--sea-ink)' }}>
        {title}
      </h1>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
```

- [ ] **Step 2: `shared/ui/index.ts` に PageHeader をエクスポートする**

`apps/pwa/shared/ui/` に `index.ts` が存在しない場合は作成、存在する場合は追記する:

```bash
ls apps/pwa/shared/ui/index.ts 2>/dev/null || echo "not found"
```

ファイルが存在しない場合は作成:
```ts
export { PageHeader } from './PageHeader'
```

ファイルが存在する場合は末尾に追加:
```ts
export { PageHeader } from './PageHeader'
```

- [ ] **Step 3: テストが通ることを確認**

```bash
cd apps/pwa && pnpm test 2>&1 | tail -5
```

Expected: 全テストパス

- [ ] **Step 4: コミット**

```bash
git add apps/pwa/shared/ui/PageHeader.tsx apps/pwa/shared/ui/index.ts
git commit -m "feat(design): PageHeader 共通コンポーネントを追加"
```

---

## Task 7: Login ページリデザイン

**Files:**
- Modify: `apps/pwa/pages/login.tsx`

- [ ] **Step 1: login.tsx を書き換える**

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { signInWithGoogle, getSession, getServerSession } from '@/shared/lib/auth'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session =
      typeof window === 'undefined'
        ? await getServerSession()
        : await getSession()
    if (session) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 gap-10"
    >
      {/* ロゴ + キャッチコピー */}
      <div className="text-center rise-in">
        <p className="island-kicker mb-3">聖典学習を分かち合う</p>
        <h1
          className="display-title text-5xl font-bold mb-3"
          style={{ color: 'var(--sea-ink)' }}
        >
          Manna
        </h1>
        <p className="text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
          感動・洞察・感想をコミュニティで共有しよう
        </p>
      </div>

      {/* サインインカード */}
      <div
        className="island-shell w-full max-w-xs rounded-2xl p-6 flex flex-col gap-4 rise-in"
        style={{ animationDelay: '120ms' }}
      >
        <button
          onClick={() => signInWithGoogle()}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: 'var(--surface-strong)',
            border: '1px solid var(--line)',
            color: 'var(--sea-ink)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.4 30.2 0 24 0 14.7 0 6.8 5.4 2.9 13.3l7.8 6C12.5 13.4 17.9 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.6 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.2-10.1 7.2-17z"/>
            <path fill="#FBBC05" d="M10.7 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l8.1-6z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.2-8.4 2.2-6.1 0-11.3-4-13.2-9.5l-8.1 6C6.7 42.7 14.7 48 24 48z"/>
          </svg>
          Google でサインイン
        </button>

        <p className="text-center text-[11px]" style={{ color: 'var(--sea-ink-soft)' }}>
          サインインすることで利用規約とプライバシーポリシーに同意します
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: テストが通ることを確認**

```bash
cd apps/pwa && pnpm test 2>&1 | tail -5
```

Expected: 全テストパス

- [ ] **Step 3: コミット**

```bash
git add apps/pwa/pages/login.tsx
git commit -m "feat(design): Login ページをブランドデザインでリデザイン"
```

---

## Task 8: 聖典ナビゲーションページ — デザイントークン適用

**Files:**
- Modify: `apps/pwa/pages/scriptures/index.tsx`
- Modify: `apps/pwa/pages/scriptures/$collection/index.tsx`
- Modify: `apps/pwa/pages/scriptures/$collection/$book/index.tsx`
- Modify: `apps/pwa/pages/scriptures/$collection/$book/$chapter.tsx`

共通方針:
- `hover:bg-gray-50` → `hover:bg-sand`（または `style={{ background: 'var(--link-bg-hover)' }}`）
- `text-blue-600` → `style={{ color: 'var(--lagoon-deep)' }}`
- `text-gray-500` / `text-gray-400` → `style={{ color: 'var(--sea-ink-soft)' }}`
- `bg-blue-100 text-blue-700` のバッジ → `style={{ background: 'var(--chip-bg)', border: '1px solid var(--chip-line)', color: 'var(--palm)' }}`
- PageHeader コンポーネントをヘッダーに使用する

- [ ] **Step 1: scriptures/index.tsx を更新する**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { getAllCollections } from '@/entities/scripture'
import { PageHeader } from '@/shared/ui/PageHeader'

export const Route = createFileRoute('/scriptures/')({
  component: ScripturesPage,
})

function ScripturesPage() {
  const collections = getAllCollections()
  return (
    <div>
      <PageHeader title="聖典" />
      <div className="p-4">
        <ul className="divide-y overflow-hidden rounded-xl" style={{ border: '1px solid var(--line)' }}>
          {collections.map((col) => (
            <li key={col.id}>
              <Link
                to="/scriptures/$collection"
                params={{ collection: col.id }}
                className="flex items-center justify-between px-4 py-3.5 transition-colors"
                style={{ color: 'var(--sea-ink)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--link-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <span className="font-medium">{col.name}</span>
                <span style={{ color: 'var(--sea-ink-soft)' }}>›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: scriptures/$collection/index.tsx を更新する**

```tsx
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getCollection } from '@/entities/scripture'
import { PageHeader } from '@/shared/ui/PageHeader'

export const Route = createFileRoute('/scriptures/$collection/')({
  loader: ({ params }) => {
    const collection = getCollection(params.collection)
    if (!collection) throw notFound()
    return collection
  },
  component: CollectionPage,
})

function CollectionPage() {
  const collection = Route.useLoaderData()
  return (
    <div>
      <PageHeader title={collection.name} backTo="/scriptures" backLabel="聖典" />
      <div className="p-4">
        <ul className="divide-y overflow-hidden rounded-xl" style={{ border: '1px solid var(--line)' }}>
          {collection.books.map((book) => (
            <li key={book.id}>
              <Link
                to="/scriptures/$collection/$book"
                params={{ collection: collection.id, book: book.id }}
                className="flex items-center justify-between px-4 py-3.5 transition-colors"
                style={{ color: 'var(--sea-ink)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--link-bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <span>{book.name}</span>
                <span className="text-sm" style={{ color: 'var(--sea-ink-soft)' }}>{book.chapters}章 ›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: scriptures/$collection/$book/index.tsx を更新する**

```tsx
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getBook, getCollection } from '@/entities/scripture'
import { PageHeader } from '@/shared/ui/PageHeader'

export const Route = createFileRoute('/scriptures/$collection/$book/')({
  loader: ({ params }) => {
    const book = getBook(params.collection, params.book)
    const collection = getCollection(params.collection)
    if (!book || !collection) throw notFound()
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
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--lagoon)'
                e.currentTarget.style.color = '#fff'
                e.currentTarget.style.borderColor = 'var(--lagoon)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface)'
                e.currentTarget.style.color = 'var(--sea-ink)'
                e.currentTarget.style.borderColor = 'var(--line)'
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

- [ ] **Step 4: scriptures/$collection/$book/$chapter.tsx を更新する**

`chapter.tsx` 内のすべての `text-blue-600` / `bg-blue-100` / `text-blue-700` / `hover:bg-gray-50` / `text-gray-400` / `text-gray-500` を CSS 変数に置き換え、ヘッダー部分に PageHeader を使う。

主な変更箇所:
1. verse モードのヘッダー:
```tsx
<PageHeader
  title={scriptureLabel}
  backTo="/scriptures/$collection/$book/$chapter"
  action={
    <Link
      to="/posts/new"
      search={{ collection, book: book.id, chapter, verses }}
      className="text-xs px-3 py-1.5 rounded-full font-semibold"
      style={{ background: 'var(--lagoon)', color: '#fff' }}
    >
      投稿する
    </Link>
  }
/>
```

2. 「公式サイトで読む」リンク:
```tsx
<a href={officialUrl} target="_blank" rel="noopener noreferrer"
   className="text-sm underline" style={{ color: 'var(--lagoon-deep)' }}>
  公式サイトで読む →
</a>
```

3. 空状態メッセージ:
```tsx
<div className="p-8 text-center text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
  この節への投稿はまだありません
</div>
```

4. 節一覧の投稿数バッジ:
```tsx
<span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: 'var(--chip-bg)', border: '1px solid var(--chip-line)', color: 'var(--palm)' }}>
  {count}件
</span>
```

5. chapter モードのヘッダー:
```tsx
<PageHeader
  title={`${book.name} 第${chapter}章`}
  backTo="/scriptures/$collection/$book"
  action={
    <a href={officialUrl} target="_blank" rel="noopener noreferrer"
       className="text-xs underline" style={{ color: 'var(--lagoon-deep)' }}>
      本文を読む
    </a>
  }
/>
```

- [ ] **Step 5: テストが通ることを確認**

```bash
cd apps/pwa && pnpm test 2>&1 | tail -5
```

Expected: 全テストパス

- [ ] **Step 6: コミット**

```bash
git add apps/pwa/pages/scriptures/
git commit -m "feat(design): 聖典ナビゲーションページに PageHeader とデザイントークンを適用"
```

---

## Task 9: Skeleton コンポーネント追加

**Files:**
- Create: `apps/pwa/shared/ui/skeleton.tsx`

- [ ] **Step 1: skeleton.tsx を作成する**

```tsx
import { cn } from '@/shared/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md', className)}
      style={{ background: 'var(--line)' }}
      {...props}
    />
  )
}

export function PostCardSkeleton() {
  return (
    <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-start gap-3 mb-2">
        <Skeleton className="w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3 w-36 rounded" />
        </div>
        <Skeleton className="h-3 w-10 rounded" />
      </div>
      <div className="ml-12 space-y-1.5">
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3.5 w-5/6 rounded" />
        <Skeleton className="h-3.5 w-3/4 rounded" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `shared/ui/index.ts` に Skeleton をエクスポートする**

```ts
export { Skeleton, PostCardSkeleton } from './skeleton'
```

- [ ] **Step 3: テストが通ることを確認**

```bash
cd apps/pwa && pnpm test 2>&1 | tail -5
```

Expected: 全テストパス

- [ ] **Step 4: コミット**

```bash
git add apps/pwa/shared/ui/skeleton.tsx apps/pwa/shared/ui/index.ts
git commit -m "feat(design): Skeleton / PostCardSkeleton コンポーネントを追加"
```

---

## 自己レビュー

### スペック網羅確認

| Issue 要件 | 対応タスク |
|-----------|-----------|
| CSS変数デザイントークン定義 | Task 1 |
| BottomNav SVGアイコン化 | Task 3 |
| PostCard ユーザー情報・聖典参照・日時 | Task 4–5 |
| 全ページの視認性統一 | Task 2, 7, 8 |
| ローディング状態 | Task 9 |
| 空状態UI | Task 8 (chapter.tsx 空状態) |
| モバイル視認性確保 | Task 1–9 全体 |

### 未対応（スコープ外）

- `pages/index.tsx`（フィード）・`posts/new.tsx`・`notifications.tsx`・`profile/index.tsx` は「実装予定」のプレースホルダーのため、この PR ではデザイントークンの適用のみ対象外とする
- dark mode は `styles.css` に変数が定義済みのため自動対応される

### 型整合確認

- `PostCard` の `PostWithUser` 型は変更なし（`$chapter.tsx` との互換を維持）
- `PageHeader` の `backTo` は文字列型のため TanStack Router の `to` prop に渡す際はキャスト不要（`to` は string を受け付ける）
