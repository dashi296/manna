# Responsive Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** モバイル（〜1023px）は BottomNav を維持しつつ、デスクトップ（lg = 1024px〜）では shadcn/ui の固定サイドバーに切り替えるレスポンシブナビゲーションを実装する。

**Architecture:** shadcn/ui の `SidebarProvider` + `Sidebar` を `RootLayout` に組み込み、`Sidebar` に `hidden lg:flex` を付与してモバイルでは非表示にする。`BottomNav` に `lg:hidden` を追加してデスクトップでは非表示にする。ログイン・コールバックページはナビゲーションを表示しない。

**Tech Stack:** shadcn/ui Sidebar, TanStack Router (`useRouterState`), lucide-react, TailwindCSS v4, Vitest

---

## File Map

| 操作 | パス | 役割 |
|------|------|------|
| Run | `apps/pwa` で `npx shadcn@latest add sidebar` | sidebar.tsx を生成 |
| Create | `apps/pwa/shared/ui/AppSidebar.tsx` | サイドバーコンポーネント |
| Modify | `apps/pwa/shared/ui/BottomNav.tsx` | `lg:hidden` 追加 |
| Modify | `apps/pwa/pages/__root.tsx` | SidebarProvider + RootLayout 更新 |
| Modify | `apps/pwa/shared/ui/index.ts` | AppSidebar エクスポート追加 |

---

## Task 1: shadcn/ui Sidebar のインストール

**Files:**
- Create: `apps/pwa/shared/ui/sidebar.tsx`（自動生成）

- [ ] **Step 1: shadcn の sidebar コンポーネントをインストールする**

```bash
cd /Users/shunokada/projects/manna/apps/pwa && npx shadcn@latest add sidebar --yes 2>&1 | tail -10
```

Expected: `✔ Done.` のような成功メッセージ。`shared/ui/sidebar.tsx` が生成される。

- [ ] **Step 2: 生成されたファイルを確認する**

```bash
ls /Users/shunokada/projects/manna/apps/pwa/shared/ui/sidebar.tsx && head -30 /Users/shunokada/projects/manna/apps/pwa/shared/ui/sidebar.tsx
```

Expected: `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarInset` がエクスポートされていることを確認。

- [ ] **Step 3: テストが通ることを確認（インストールで既存ファイルが壊れていないか）**

```bash
cd /Users/shunokada/projects/manna/apps/pwa && npx vitest run 2>&1 | tail -6
```

Expected: `Tests 15 passed (15)`

- [ ] **Step 4: コミット**

```bash
cd /Users/shunokada/projects/manna && git add apps/pwa/shared/ui/sidebar.tsx apps/pwa/package.json apps/pwa/components.json && git commit -m "feat(deps): shadcn/ui sidebar コンポーネントをインストール"
```

---

## Task 2: AppSidebar コンポーネントの作成

**Files:**
- Create: `apps/pwa/shared/ui/AppSidebar.tsx`

- [ ] **Step 1: AppSidebar.tsx を作成する**

```tsx
import { Link, useRouterState } from '@tanstack/react-router'
import { Home, BookOpen, PenLine, Bell, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getSession } from '@/shared/lib/auth'
import { cn } from '@/shared/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/sidebar'

const NAV_ITEMS = [
  { to: '/', label: 'フィード', Icon: Home },
  { to: '/scriptures', label: '聖典', Icon: BookOpen },
  { to: '/posts/new', label: '投稿する', Icon: PenLine },
  { to: '/notifications', label: '通知', Icon: Bell },
  { to: '/profile', label: 'プロフィール', Icon: User },
] as const

type UserInfo = { displayName: string | null; avatarUrl: string | null } | null

export function AppSidebar() {
  const { location } = useRouterState()
  const [userInfo, setUserInfo] = useState<UserInfo>(null)

  useEffect(() => {
    getSession().then((session) => {
      if (session?.user) {
        setUserInfo({
          displayName: session.user.user_metadata?.full_name ?? null,
          avatarUrl: session.user.user_metadata?.avatar_url ?? null,
        })
      }
    })
  }, [])

  return (
    <Sidebar collapsible="none" className="hidden lg:flex border-r" style={{ borderColor: 'var(--line)', background: 'var(--header-bg)', width: '220px' }}>
      {/* ロゴ */}
      <SidebarHeader className="px-4 py-5">
        <span
          className="font-display text-2xl font-bold tracking-wide"
          style={{ color: 'var(--lagoon)' }}
        >
          Manna
        </span>
      </SidebarHeader>

      {/* ナビゲーション */}
      <SidebarContent className="px-2">
        <SidebarMenu>
          {NAV_ITEMS.map(({ to, label, Icon }) => {
            const active =
              location.pathname === to ||
              (to !== '/' && location.pathname.startsWith(to))
            return (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton asChild isActive={active}>
                  <Link
                    to={to}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full',
                      active
                        ? 'text-lagoon-deep bg-[rgba(79,184,178,0.1)]'
                        : 'text-sea-ink-soft hover:text-sea-ink hover:bg-[var(--link-bg-hover)]'
                    )}
                  >
                    <Icon size={18} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                    {label}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* ユーザー情報 */}
      {userInfo && (
        <SidebarFooter className="px-4 py-4 border-t" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-3">
            {userInfo.avatarUrl ? (
              <img
                src={userInfo.avatarUrl}
                alt={userInfo.displayName ?? 'ユーザー'}
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: 'var(--lagoon)', color: '#fff' }}
                aria-hidden="true"
              >
                {(userInfo.displayName ?? 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs font-medium truncate" style={{ color: 'var(--sea-ink-soft)' }}>
              {userInfo.displayName ?? 'ユーザー'}
            </span>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
```

- [ ] **Step 2: テストが通ることを確認**

```bash
cd /Users/shunokada/projects/manna/apps/pwa && npx vitest run 2>&1 | tail -6
```

Expected: `Tests 15 passed (15)`

- [ ] **Step 3: コミット**

```bash
cd /Users/shunokada/projects/manna && git add apps/pwa/shared/ui/AppSidebar.tsx && git commit -m "feat(design): AppSidebar コンポーネントを追加"
```

---

## Task 3: BottomNav に lg:hidden を追加

**Files:**
- Modify: `apps/pwa/shared/ui/BottomNav.tsx:17`

- [ ] **Step 1: BottomNav の nav 要素に lg:hidden を追加する**

変更前:
```tsx
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t border-line bg-[var(--header-bg)] backdrop-blur-sm">
```

変更後:
```tsx
    <nav className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t border-line bg-[var(--header-bg)] backdrop-blur-sm">
```

- [ ] **Step 2: テストが通ることを確認**

```bash
cd /Users/shunokada/projects/manna/apps/pwa && npx vitest run 2>&1 | tail -6
```

Expected: `Tests 15 passed (15)`

- [ ] **Step 3: コミット**

```bash
cd /Users/shunokada/projects/manna && git add apps/pwa/shared/ui/BottomNav.tsx && git commit -m "fix(design): BottomNav を lg 以上で非表示にする"
```

---

## Task 4: RootLayout をサイドバー対応に更新

**Files:**
- Modify: `apps/pwa/pages/__root.tsx`

- [ ] **Step 1: __root.tsx を読んで現在の RootLayout を確認する**

```bash
cat /Users/shunokada/projects/manna/apps/pwa/pages/__root.tsx
```

- [ ] **Step 2: import 行を更新する**

変更前:
```tsx
import { HeadContent, Scripts, Outlet, createRootRoute, redirect } from '@tanstack/react-router'
import { getSession, getServerSession } from '@/shared/lib/auth'
import { BottomNav } from '@/shared/ui/BottomNav'
import { DevTools } from '@/shared/ui/DevTools'
import appCss from '@/src/styles.css?url'
```

変更後:
```tsx
import { HeadContent, Scripts, Outlet, createRootRoute, redirect, useRouterState } from '@tanstack/react-router'
import { getSession, getServerSession } from '@/shared/lib/auth'
import { AppSidebar } from '@/shared/ui/AppSidebar'
import { BottomNav } from '@/shared/ui/BottomNav'
import { DevTools } from '@/shared/ui/DevTools'
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar'
import appCss from '@/src/styles.css?url'
```

- [ ] **Step 3: RootLayout 関数を更新する**

変更前:
```tsx
function RootLayout() {
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col">
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
```

変更後:
```tsx
function RootLayout() {
  const { location } = useRouterState()
  const isAuthPage =
    location.pathname === '/login' || location.pathname.startsWith('/auth/')

  if (isAuthPage) {
    return <Outlet />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen min-w-0">
        <main className="flex-1 pb-16 lg:pb-0">
          <div className="max-w-md mx-auto">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
cd /Users/shunokada/projects/manna/apps/pwa && npx vitest run 2>&1 | tail -6
```

Expected: `Tests 15 passed (15)`

- [ ] **Step 5: ビルドが通ることを確認**

```bash
cd /Users/shunokada/projects/manna/apps/pwa && pnpm build 2>&1 | tail -8
```

Expected: `✓ built in` のような成功メッセージ

- [ ] **Step 6: コミット**

```bash
cd /Users/shunokada/projects/manna && git add apps/pwa/pages/__root.tsx && git commit -m "feat(design): RootLayout にレスポンシブサイドバーを組み込み"
```

---

## Task 5: shared/ui/index.ts に AppSidebar をエクスポート

**Files:**
- Modify: `apps/pwa/shared/ui/index.ts`

- [ ] **Step 1: index.ts に AppSidebar のエクスポートを追加する**

変更前:
```ts
export { PageHeader } from './PageHeader'
export { Skeleton, PostCardSkeleton } from './skeleton'
```

変更後:
```ts
export { AppSidebar } from './AppSidebar'
export { PageHeader } from './PageHeader'
export { Skeleton, PostCardSkeleton } from './skeleton'
```

- [ ] **Step 2: テストが通ることを確認**

```bash
cd /Users/shunokada/projects/manna/apps/pwa && npx vitest run 2>&1 | tail -6
```

Expected: `Tests 15 passed (15)`

- [ ] **Step 3: コミット**

```bash
cd /Users/shunokada/projects/manna && git add apps/pwa/shared/ui/index.ts && git commit -m "feat(design): shared/ui/index.ts に AppSidebar をエクスポート追加"
```

---

## 自己レビュー

### スペック網羅確認

| 仕様要件 | 対応タスク |
|---------|-----------|
| shadcn/ui Sidebar 使用 | Task 1, 2, 4 |
| lg（1024px）ブレークポイント | Task 2（`hidden lg:flex`）, Task 3（`lg:hidden`）|
| ロゴ + アイコン + ラベルのサイドバー | Task 2 |
| テーマ追従（CSS変数使用） | Task 2（`var(--header-bg)`, `var(--lagoon)` 等）|
| ユーザーアバター（フッター） | Task 2 |
| BottomNav をモバイルのみに限定 | Task 3 |
| ログイン/認証ページでサイドバー非表示 | Task 4 |
| コンテンツ幅 max-w-md を維持 | Task 4 |
| shared/ui/index.ts エクスポート | Task 5 |

### プレースホルダースキャン

なし。全ステップに具体的なコードを記載済み。

### 型整合確認

- `UserInfo` 型（Task 2）: `{ displayName: string | null; avatarUrl: string | null } | null` — 一貫して使用
- `NAV_ITEMS` の `to` 型: Task 2 の `as const` により文字列リテラル型 — TanStack Router の `Link to` と互換
- `SidebarProvider`, `SidebarInset` は Task 1 でインストールされた `sidebar.tsx` から import — Task 4 で使用
