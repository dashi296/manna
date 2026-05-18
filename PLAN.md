# Manna — 実装計画

末日聖徒イエスキリスト教会の聖典学習体験共有アプリ。

詳細計画書: [`docs/superpowers/plans/2026-05-19-manna-phase1.md`](docs/superpowers/plans/2026-05-19-manna-phase1.md)

---

## プロダクト概要

聖典を学びながら感じた感動・洞察・感想をオンラインで共有するSNS。

- 公式聖典サイト（churchofjesuschrist.org）のテキストは自前で持たず、ディープリンクで参照
- スモールスタート（友人・ワード）から始め、将来的には世界中のLDS会員を対象に拡張

---

## フェーズ

| フェーズ | 内容 | 状態 |
|---|---|---|
| **Phase 1** | PWA（本計画書のスコープ） | 🚧 実装中 |
| **Phase 2** | Chrome拡張（Plasmo）— 公式聖典サイトから直接投稿 | 📋 計画中 |

---

## 技術スタック

| 役割 | 技術 |
|---|---|
| フロントエンド | TanStack Start + TypeScript + TailwindCSS v4 |
| UIコンポーネント | shadcn/ui（Radix UI + Tailwind） |
| バックエンド / DB | Supabase（PostgreSQL + Auth + Realtime + Storage） |
| 認証 | Google OAuth（Supabase Auth経由） |
| ホスティング | Vercel / Netlify / Cloudflare Pages |
| フロントエンド構造 | Feature Sliced Design（FSD） |
| テスト | Vitest + @testing-library/react |

---

## ディレクトリ構造（FSD）

```
manna/
├── app/routes/          # TanStack Start ルート（薄いラッパー）
├── pages/               # ページコンポーネント
├── widgets/             # 複合UIブロック
├── features/            # ユーザー操作
├── entities/            # ビジネスエンティティ（post / user / scripture）
├── shared/              # 共有インフラ（supabase / auth / shadcn/ui）
└── supabase/migrations/ # DBマイグレーション
```

FSDインポートルール: 上位の層は下位の層のみimport可。各スライスは `index.ts` でパブリックAPIを公開。

---

## 主要機能

### 投稿
- Markdown形式の長文ノート投稿
- 聖典参照（書籍・章・節）の紐付け（任意）
- 公開範囲: **公開 / フォロワー / ファミリー / 非公開** の4段階

### 聖典ナビゲーター
- モルモン書・教義と聖約・高価な真珠・旧約・新約に対応
- 書籍 → 章 → 節の階層ナビゲーション
- 節ごとに投稿数バッジを表示
- 節から公式サイトへのディープリンク

### ソーシャル
- フォロー（一方向、承認不要）
- ファミリー（双方向、招待→承認制）
- 通知（フォロー・ファミリー招待/承認）

---

## データモデル

| テーブル | 用途 |
|---|---|
| `users` | ユーザープロフィール |
| `posts` | 投稿（Markdown本文 + 聖典参照 + 公開範囲） |
| `follows` | フォロー関係（一方向） |
| `family_relationships` | ファミリー関係（双方向・承認制） |
| `notifications` | 通知（liked / followed / family_requested / family_accepted） |
| `likes` | いいね（Phase 2で実装予定） |

公開範囲はSupabaseのRow Level Securityで実装。DB層で強制するため、APIを直接叩いても意図しないデータが漏れない。

---

## 実装タスク（GitHub Issues）

| Issue | タスク | ブランチ |
|---|---|---|
| [#1](https://github.com/dashi296/manna/issues/1) | プロジェクトセットアップ | `task/01-project-setup` |
| [#2](https://github.com/dashi296/manna/issues/2) | Supabaseスキーマ + RLS + トリガー | `task/02-supabase-schema` |
| [#3](https://github.com/dashi296/manna/issues/3) | Supabaseクライアント + Google OAuth認証 | `task/03-auth` |
| [#4](https://github.com/dashi296/manna/issues/4) | 聖典データ + URLビルダー | `task/04-scripture-data` |
| [#5](https://github.com/dashi296/manna/issues/5) | 聖典ナビゲーター画面 | `task/05-scripture-navigator` |
| [#6](https://github.com/dashi296/manna/issues/6) | 投稿作成画面 | `task/06-post-creation` |
| [#7](https://github.com/dashi296/manna/issues/7) | フィード画面 + PostCard | `task/07-feed` |
| [#9](https://github.com/dashi296/manna/issues/9) | フォロー + ファミリー機能 | `task/08-social` |
| [#10](https://github.com/dashi296/manna/issues/10) | プロフィール画面 | `task/09-profile` |
| [#11](https://github.com/dashi296/manna/issues/11) | 通知画面 | `task/10-notifications` |
| [#12](https://github.com/dashi296/manna/issues/12) | 投稿詳細画面 | `task/11-post-detail` |
| [#13](https://github.com/dashi296/manna/issues/13) | PWA設定 | `task/12-pwa` |

---

## 開発フロー

1. issueを選んでブランチを切る（例: `git checkout -b task/01-project-setup`）
2. 実装（詳細な手順は[詳細計画書](docs/superpowers/plans/2026-05-19-manna-phase1.md)を参照）
3. PRを作成してissueに紐付ける
4. レビュー後マージ → 次のタスクへ

---

## スコープ外（Phase 1）

- **いいね機能** — Phase 2以降で実装（DBスキーマには `likes` テーブルを準備済み）
- **Chrome拡張** — Phase 2
- **多言語対応** — UIは日本語固定。i18n化を妨げない構造にする
- **プッシュ通知** — アプリ内通知のみ
