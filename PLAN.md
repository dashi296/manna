# Manna — 実装計画

## ドキュメント

| ドキュメント | 内容 |
|---|---|
| [README.md](README.md) | プロジェクト概要・技術スタック・着手順 |
| [CLAUDE.md](CLAUDE.md) | アーキテクチャルール・重要パターン（Claude Code 用） |
| [詳細実装計画](docs/superpowers/plans/2026-05-19-manna-phase1.md) | 全タスクの手順・コードサンプル |
| [設計書](docs/superpowers/specs/2026-05-19-manna-design.md) | データモデル・画面設計・アーキテクチャ |

## フェーズ

| フェーズ | 内容 | 状態 |
|---|---|---|
| **Phase 1** | PWA（本計画書のスコープ） | 🚧 実装中 |
| **Phase 2** | Chrome拡張（Plasmo）— 公式聖典サイトから直接投稿 | 📋 計画中 |

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

## スコープ外（Phase 1）

- **いいね機能** — Phase 2以降（DBスキーマには `likes` テーブルを準備済み）
- **Chrome拡張** — Phase 2
- **多言語対応** — UIは日本語固定（i18n化を妨げない構造にする）
- **プッシュ通知** — アプリ内通知のみ
