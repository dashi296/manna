# Manna

末日聖徒イエスキリスト教会の聖典学習体験共有SNS。

聖典を学びながら感じた感動・洞察・感想をオンラインで共有する。公式聖典サイト（churchofjesuschrist.org）のテキストは自前で持たず、ディープリンクで参照する。

## 技術スタック

| 役割 | 技術 |
|---|---|
| フロントエンド | TanStack Start (TypeScript / Vite / SSR) |
| UIコンポーネント | shadcn/ui (Radix UI + Tailwind) |
| バックエンド / DB | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| 認証 | Google OAuth (Supabase Auth経由) |
| フロントエンド構造 | Feature Sliced Design (FSD) |
| テスト | Vitest + @testing-library/react |

## ディレクトリ構造（FSD）

```
manna/
├── pages/        # TanStack Start ルート定義 (routesDirectory) 兼 FSD pages 層
├── widgets/      # 複合UIブロック
├── features/     # ユーザー操作・ビジネスロジック
├── entities/     # ビジネスエンティティ (post / user / scripture)
├── shared/       # 共有インフラ (supabase / auth / shadcn/ui)
└── supabase/migrations/
```

`@/` エイリアスはプロジェクトルートを指す。各スライスは `index.ts` でパブリック API を公開し、外部からは `index.ts` 経由のみでインポートする。

## 実装計画

[docs/superpowers/plans/2026-05-19-manna-phase1.md](docs/superpowers/plans/2026-05-19-manna-phase1.md) に全タスクの詳細手順・コードサンプルを記載。

GitHub Issues でタスクを管理。依存順に着手すること:

1. [#1 プロジェクトセットアップ](https://github.com/dashi296/manna/issues/1)
2. [#2 Supabaseスキーマ + RLS + トリガー](https://github.com/dashi296/manna/issues/2)
3. [#3 Supabaseクライアント + 認証](https://github.com/dashi296/manna/issues/3)
4. [#4 聖典データ + URLビルダー](https://github.com/dashi296/manna/issues/4)
5. [#5 聖典ナビゲーター画面](https://github.com/dashi296/manna/issues/5)
6. [#6 投稿作成画面](https://github.com/dashi296/manna/issues/6)
7. [#7 フィード画面 + PostCard](https://github.com/dashi296/manna/issues/7)
8. [#9 フォロー + ファミリー機能](https://github.com/dashi296/manna/issues/9)
9. [#10 プロフィール画面](https://github.com/dashi296/manna/issues/10)
10. [#11 通知画面](https://github.com/dashi296/manna/issues/11)
11. [#12 投稿詳細画面](https://github.com/dashi296/manna/issues/12)
12. [#13 PWA設定](https://github.com/dashi296/manna/issues/13)
