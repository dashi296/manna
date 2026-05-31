# レスポンシブサイドバー 設計仕様

## Goal

モバイル（〜1023px）では現状の BottomNav を維持しつつ、デスクトップ（1024px〜）では shadcn/ui の Sidebar を使った固定サイドバーナビゲーションに切り替える。テーマ（ライト/ダーク）に自動追従する。

## ブレークポイント

| 幅 | ナビゲーション |
|---|---|
| 〜1023px（`< lg`） | BottomNav（現状維持） |
| 1024px〜（`lg+`） | 左サイドバー固定表示 |

## コンポーネント設計

### 新規: `apps/pwa/shared/ui/AppSidebar.tsx`

shadcn/ui の `Sidebar` コンポーネントを使用。

**構成（上から順）:**
1. **ヘッダー** — `SidebarHeader` — "Manna" ロゴ（Fraunces フォント、`--lagoon` カラー）
2. **ナビゲーション** — `SidebarContent` + `SidebarMenu` — 5項目（アイコン + ラベル）
3. **フッター** — `SidebarFooter` — ユーザーアバター + 表示名

**ナビ項目:**
| ラベル | アイコン | to |
|---|---|---|
| フィード | `Home` | `/` |
| 聖典 | `BookOpen` | `/scriptures` |
| 投稿する | `PenLine` | `/posts/new` |
| 通知 | `Bell` | `/notifications` |
| プロフィール | `User` | `/profile` |

**アクティブ状態:** TanStack Router の `useRouterState` で現在パスを判定し、アクティブ項目を `--lagoon-deep` カラーでハイライト。

**テーマ追従:**
- ライトモード: 背景 `var(--header-bg)`、テキスト `var(--sea-ink)`、ボーダー `var(--line)`
- ダークモード: 背景 `var(--foam)`、テキスト `var(--sea-ink)`（ダーク変数に自動切替）
- 既存の `@media (prefers-color-scheme: dark)` と `[data-theme="dark"]` CSS変数で自動対応

**幅:** 220px 固定（折りたたみなし）

### 変更: `apps/pwa/shared/ui/BottomNav.tsx`

`nav` 要素に `lg:hidden` を追加してデスクトップで非表示にする。

### 変更: `apps/pwa/pages/__root.tsx`

`RootLayout` を以下の2分岐にする:

```
モバイル（デフォルト）:
  div.max-w-md.mx-auto.min-h-screen.flex.flex-col
    main.flex-1.pb-16 → <Outlet />
    <BottomNav />（lg:hidden）

デスクトップ（lg+）:
  SidebarProvider
    div.flex.min-h-screen（フル幅）
      <AppSidebar />（220px 固定）
      main.flex-1
        div.max-w-md.mx-auto → <Outlet />
```

実装は単一の `RootLayout` で `lg:` prefix のクラスで対応する（条件分岐コンポーネントは作らない）。

### 変更: ログインページのレイアウト除外

`/login` ルートはサイドバーを表示しない。

**方針:** `createRootRoute` の `component` を `RootLayout`（サイドバーあり）と `AuthLayout`（サイドバーなし）に分けるのではなく、`RootLayout` 内で現在パスが `/login` または `/auth/*` のときサイドバーと BottomNav を非表示にする。

```tsx
const isAuthPage = location.pathname === '/login' || location.pathname.startsWith('/auth/')
```

`isAuthPage` が true のときは `<AppSidebar />` と `<BottomNav />` をレンダリングしない。

### shadcn/ui Sidebar のインストール

```bash
cd apps/pwa && npx shadcn add sidebar
```

生成ファイル: `shared/ui/sidebar.tsx`（shadcn の慣例に従い `@/shared/ui` に配置）

## データフロー

- ユーザー情報（アバター URL・表示名）は `AppSidebar` 内で `getSession()` を使用して取得する（クライアントサイドのみ。サイドバーは認証済みページにしか表示されないため）
- セッションが取れない場合はアバター部分を非表示にする（`null` チェック）

## エクスポート

`shared/ui/index.ts` に追記:
```ts
export { AppSidebar } from './AppSidebar'
```

## テスト方針

- BottomNav の既存テストはなし（レンダリングテストのみ）
- `AppSidebar` の単体テストは追加しない（shadcn/ui コンポーネントのラッパーのため）
- 既存の 15 テストが全通過であることを確認する

## スコープ外

- サイドバーの折りたたみ/展開
- テーマ切り替えトグルボタン（テーマはシステム設定に追従）
- PC 向けのコンテンツ幅拡張（引き続き `max-w-md`）
- 聖典ページ・投稿ページなど各ページの PC 最適化
