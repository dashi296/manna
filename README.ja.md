# Manna

末日聖徒イエスキリスト教会の聖典学習体験共有SNS。

聖典を学びながら感じた感動・洞察・感想をオンラインで共有する。公式聖典サイト（churchofjesuschrist.org）のテキストは自前で持たず、ディープリンクで参照する。

> [English README](README.md)

---

## 技術スタック

| 役割 | 技術 |
|---|---|
| フロントエンド | TanStack Start (TypeScript / Vite / SSR) |
| UIコンポーネント | shadcn/ui (Radix UI + Tailwind CSS v4) |
| バックエンド / DB | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| 認証 | Google OAuth (Supabase Auth 経由) |
| フロントエンド構造 | Feature Sliced Design (FSD) |
| テスト | Vitest + @testing-library/react |
| 開発環境 | devbox (Node.js 24 + pnpm 9 を Nix で管理) |

---

## ディレクトリ構造

```
manna/
├── apps/
│   └── pwa/              # TanStack Start PWA (@manna/pwa)
│       ├── pages/        # ルート定義 (routesDirectory) 兼 FSD pages 層
│       ├── widgets/      # 複合 UI ブロック
│       ├── features/     # ユーザー操作・ビジネスロジック
│       ├── entities/     # ビジネスエンティティ (post / user / scripture)
│       └── shared/       # 共有インフラ (supabase / auth / shadcn/ui)
├── packages/
│   └── database/         # Supabase 生成 TypeScript 型 (@manna/database)
└── supabase/
    └── migrations/       # Supabase CLI マイグレーション
```

`@/` エイリアスは `apps/pwa/` を指す。各スライスは `index.ts` でパブリック API を公開し、外部からは `index.ts` 経由のみでインポートする。

---

## セットアップ

### 前提条件

- [devbox](https://www.jetify.com/devbox) をインストール済みであること
- Supabase プロジェクトへのアクセス権

### 環境変数

`apps/pwa/.env.local` を作成し、以下を設定する:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### インストールと起動

```bash
# devbox がインストールされていない場合
curl -fsSL https://get.jetify.com/devbox | bash

# パッケージインストールと開発サーバー起動
devbox install
devbox run dev
```

devbox shell に入って直接コマンドを使う場合:

```bash
devbox shell
pnpm install
pnpm dev
```

開発サーバーは http://localhost:3000 で起動する。

---

## テスト

```bash
# 全テスト実行
pnpm test

# ウォッチモード
pnpm --filter @manna/pwa test -- --watch
```

---

## 実装計画・タスク管理

詳細な実装計画は [`docs/superpowers/plans/2026-05-19-manna-phase1.md`](docs/superpowers/plans/2026-05-19-manna-phase1.md) に記載。

GitHub Issues でタスクを管理。依存順に着手すること:

1. [#1 プロジェクトセットアップ](https://github.com/dashi296/manna/issues/1)
2. [#2 Supabase スキーマ + RLS + トリガー](https://github.com/dashi296/manna/issues/2)
3. [#3 Supabase クライアント + 認証](https://github.com/dashi296/manna/issues/3)
4. [#4 聖典データ + URL ビルダー](https://github.com/dashi296/manna/issues/4)
5. [#5 聖典ナビゲーター画面](https://github.com/dashi296/manna/issues/5)
6. [#6 投稿作成画面](https://github.com/dashi296/manna/issues/6)
7. [#7 フィード画面 + PostCard](https://github.com/dashi296/manna/issues/7)
8. [#9 フォロー + ファミリー機能](https://github.com/dashi296/manna/issues/9)
9. [#10 プロフィール画面](https://github.com/dashi296/manna/issues/10)
10. [#11 通知画面](https://github.com/dashi296/manna/issues/11)
11. [#12 投稿詳細画面](https://github.com/dashi296/manna/issues/12)
12. [#13 PWA 設定](https://github.com/dashi296/manna/issues/13)
