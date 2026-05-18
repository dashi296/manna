# Manna — 設計書

**作成日**: 2026-05-19  
**プロジェクト**: 末日聖徒イエスキリスト教会の聖典学習体験共有アプリ

---

## 概要

聖典を学びながら感じた感動・洞察・感想をオンラインで共有するSNS。公式聖典サイト（churchofjesuschrist.org）のテキストは自前で持たず参照リンクのみで連携する。スモールスタート（友人・ワード）から始め、将来的には世界中のLDS会員を対象に拡張する。

---

## フェーズ

| フェーズ | 内容 |
|---|---|
| **Phase 1** | PWA（本設計書のスコープ） |
| **Phase 2** | Chrome拡張（Plasmo）— 公式聖典サイトから直接投稿 |

---

## 技術スタック

| 役割 | 技術 |
|---|---|
| フロントエンド | TanStack Start（TypeScript / Vite / SSR） |
| バックエンド / DB | Supabase（PostgreSQL + Auth + Storage + Realtime） |
| 認証 | Google OAuth（Supabase Auth経由） |
| ホスティング | Vercel / Netlify / Cloudflare Pages |
| Phase 2 拡張 | Plasmo（Chrome拡張フレームワーク） |

---

## アーキテクチャ

```
[ブラウザ / PWA]
  TanStack Start
    ├── 聖典ナビゲーター（静的JSON定義）
    ├── フィード
    ├── 投稿作成（Markdownエディタ）
    └── プロフィール / 通知

        ↕ Supabase JS Client

[Supabase]
  ├── PostgreSQL + Row Level Security（公開範囲強制）
  ├── Auth（Google OAuth）
  ├── Realtime（フィード更新）
  └── Storage（投稿内画像）

[公式聖典サイト] ← ディープリンクのみ（聖典テキストは自前で持たない）
```

### 聖典テキストの方針

聖典本文はアプリ内に保存しない。書籍・章・節の参照情報のみDBに保存し、本文は公式サイトへのディープリンクで参照する。著作権問題を回避しつつ、常に公式の最新訳を参照できる。

URLパターン例:  
`https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn&id=p7`

---

## データモデル

### users

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | Supabase auth.users の FK |
| display_name | text | 表示名 |
| avatar_url | text? | アバター画像URL |
| bio | text? | 自己紹介 |
| created_at | timestamptz | |

### posts

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | |
| user_id | uuid | users FK |
| content | text | Markdown本文 |
| scripture_collection | text? | 例: bofm, dc-testament, ot, nt, pgp |
| scripture_book | text? | 例: 1-ne, alma, mosiah |
| scripture_chapter | int? | 章番号 |
| scripture_verse_start | int? | 節番号（開始） |
| scripture_verse_end | int? | 節番号（終了、範囲指定時） |
| visibility | enum | public / followers / family / private |
| created_at | timestamptz | |
| updated_at | timestamptz | |

scripture_* カラムはすべてnullable（聖典参照なしの自由投稿も可能）。

### likes

| カラム | 型 | 説明 |
|---|---|---|
| post_id | uuid | posts FK |
| user_id | uuid | users FK |
| created_at | timestamptz | |

UNIQUE (post_id, user_id)

### follows

| カラム | 型 | 説明 |
|---|---|---|
| follower_id | uuid | users FK |
| following_id | uuid | users FK |
| created_at | timestamptz | |

PRIMARY KEY (follower_id, following_id)。一方向。承認不要。

### family_relationships

| カラム | 型 | 説明 |
|---|---|---|
| requester_id | uuid | 招待したユーザー (users FK) |
| addressee_id | uuid | 招待されたユーザー (users FK) |
| status | enum | pending / accepted |
| created_at | timestamptz | |

PRIMARY KEY (requester_id, addressee_id)。双方向・相互承認制。承認後は両方向でファミリーとして扱う。

### notifications

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | |
| user_id | uuid | 通知を受け取るユーザー (users FK) |
| type | enum | liked / followed / family_requested / family_accepted |
| actor_id | uuid | アクションを起こしたユーザー (users FK) |
| post_id | uuid? | 関連投稿 (likes の場合) |
| read | boolean | 既読フラグ（デフォルト false） |
| created_at | timestamptz | |

---

## 公開範囲（Row Level Security）

| visibility | 閲覧できるユーザー |
|---|---|
| public | 誰でも（未ログインも可） |
| followers | 投稿者をフォローしているユーザー |
| family | 承認済みファミリーのメンバー |
| private | 投稿者本人のみ |

公開範囲はSupabaseのRLSで実装する。アプリコード層ではなくDB層で強制することで、APIを直接叩いても意図しないデータが漏れない。

---

## 主要画面

### ボトムナビゲーション
フィード / 聖典 / 投稿 / 通知 / プロフィール

### フィード
- タブ: フォロー中 / 全体（publicのみ）
- 投稿カード: 聖典参照バッジ・本文プレビュー・いいね数
- カードタップで全文（Markdown描画）表示
- 無限スクロール

### 聖典ナビゲーター
- 聖典集 → 書籍 → 章 → 節一覧の階層ナビゲーション
- 書籍・章・節の定義は静的JSONファイルとしてアプリに同梱
- 節ごとに投稿数バッジを表示
- 節タップ → 節ページへ
- 公式サイトで本文を読むリンク

### 節ページ
- 書名・章・節の参照ヘッダー
- 公式サイトへのディープリンク
- この節への投稿一覧（いいね順 / 新着順 切替）
- 「この節について投稿する」ボタン

### 投稿作成
- 聖典参照セレクター（任意。節ページから開いた場合は自動入力）
- Markdownエディタ（編集 / プレビュー タブ切替）
- 公開範囲セレクター（public / followers / family / private）
- 投稿 / 下書き保存（下書きはlocalStorageに保存、DBには保存しない）

### 通知
- いいねされた
- フォローされた
- ファミリー招待が届いた
- ファミリー招待が承認された

### プロフィール
- アバター・表示名・自己紹介
- 投稿一覧（自分のプロフィールは全公開範囲を表示、他人は公開分のみ）
- フォロワー数 / フォロー中数 / ファミリー数
- ファミリー招待ボタン（他人のプロフィール閲覧時）

---

## エラーハンドリング

- **認証切れ**: Supabase Authがトークンをリフレッシュ。失敗時はログイン画面へリダイレクト
- **投稿失敗**: トースト通知で表示し、入力内容はlocalStorageに退避して消えないようにする
- **ネットワーク断**: PWAのService Workerでオフライン時にフォールバック画面を表示
- **RLS違反**: 403エラーを「このコンテンツは表示できません」に変換してUI表示

---

## スケール戦略

| 時期 | 対応 |
|---|---|
| スモールスタート | Supabase無料枠で十分 |
| 日本語コミュニティ規模 | Supabase Pro + インデックス最適化 |
| 多言語・世界展開 | UIのi18n対応、UIテキストの国際化 |

多言語対応はPhase 1のスコープ外。UIは日本語固定でスタートし、将来のi18n化を妨げない構造（ハードコードしない）にする。

---

## Phase 2: Chrome拡張（スコープ外・参考）

- Plasmoフレームワークで実装
- 公式聖典サイトのURLを解析して書籍・章・節を自動抽出
- サイドパネルまたはポップアップで投稿フォームを表示
- 同じSupabaseバックエンドに投稿（認証共有）
