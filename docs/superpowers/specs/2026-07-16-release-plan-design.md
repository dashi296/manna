# Manna Phase 1 リリース計画 設計書

**Date:** 2026-07-16

---

## 概要

Phase 1 の残りタスク（#7, #9, #10, #11, #12, #13）と聖典テキスト表示機能を実装し、リリース可能な状態にする。

## 現状

**完了済み（main ブランチ）:**
- プロジェクトセットアップ、Supabase スキーマ + RLS + トリガー
- Google OAuth 認証（サーバーサイドコールバック）
- 聖典データ + URLビルダー + ナビゲーター画面
- デザインシステム（shadcn/ui + カスタムテーマ）
- Cloudflare Pages デプロイ設定 + 本番 Supabase 環境

**PR #37（未マージ）:**
- 投稿作成画面（PostEditor, ScriptureSelector, VisibilitySelector, MarkdownRenderer）
- PostCard コンポーネント
- 聖典テキスト取得スクリプト + scripture_verses テーブル

**未実装:**
- フィード画面（pages/index.tsx — スタブ）
- フォロー / ファミリー機能
- プロフィール画面（pages/profile/index.tsx — スタブ）
- 通知画面（pages/notifications.tsx — スタブ）
- 投稿詳細画面（pages/posts/$id.tsx — 未作成）
- 聖典テキストのアプリ内表示
- PWA 設定

## アーキテクチャ方針

既存の FSD 構成を維持:

```
pages/           ← ルート定義 + FSD pages 層
widgets/         ← 複合 UI（post-editor は既存）
features/        ← 新規: follow-user, manage-family
entities/        ← 既存: post, scripture
shared/          ← 既存の UI / lib を活用
```

データ取得は `createServerFn` (SSR) を使い、既存パターン（$chapter.tsx の fetchVersePosts 等）に合わせる。

---

## フェーズ構成

### フェーズ 1: 閲覧体験

PR #37 マージ後、投稿を「書いて読む」コア体験を完成させる。

#### 1-0. PR #37 マージ

`task/06-post-creation` ブランチの PR #37 を main にマージ。聖典テキスト取得関連（scripture_tables マイグレーション、fetch-scriptures スクリプト、seed 関連）も含まれる。

#### 1-1. フィード画面（Issue #7）

**ファイル:**
- 修正: `pages/index.tsx`（スタブ → 実装）

**機能:**
- 2タブ構成:「フォロー中」/「全体」
- 「全体」タブ: `visibility = 'public'` の投稿を新着順 20 件
- 「フォロー中」タブ: follows テーブルから following_id を取得し、そのユーザーの投稿を表示
- PostCard（entities/post）を使用
- 空状態メッセージ

**データ取得:** `createServerFn` でサーバーサイド取得。認証済みユーザーの場合、SSR 用 Supabase クライアント（cookie ベース）で follows を参照。

#### 1-2. 投稿詳細画面（Issue #12）

**ファイル:**
- 新規: `pages/posts/$id.tsx`

**機能:**
- 投稿の全内容（Markdown レンダリング）
- 投稿者情報（Avatar + 名前、プロフィールへのリンク）
- 聖典参照バッジ（聖典ナビゲーターの該当節ページへリンク）
- 公式サイトへのリンク

**データ取得:** `createServerFn` で `posts` + `users` を JOIN 取得。

#### 1-3. 聖典テキスト表示

**ファイル:**
- 修正: `pages/scriptures/$collection/$book/$chapter.tsx`

**機能:**
- 章ページ: 節一覧で各節のテキスト（`text_html` — ruby タグ付き）を表示
- 節ページ（`?verses=N`）: 該当節のテキストを投稿一覧の上に表示
- `scripture_verses` テーブルからサーバーサイドで取得

**表示:** `text_html` は `<ruby><rb>漢字</rb><rt>よみ</rt></ruby>` を含むため HTML として描画する。DOMPurify でサニタイズし、許可タグを `ruby`, `rb`, `rt` のみに制限した上で `dangerouslySetInnerHTML` で表示する。データソースは Church API だがサニタイズは必須。

---

### フェーズ 2: ソーシャル体験

ユーザー間のつながりと通知を実装。

#### 2-1. フォロー機能（Issue #9 前半）

**ファイル:**
- 新規: `features/follow-user/ui/FollowButton.tsx`
- 新規: `features/follow-user/index.ts`
- 新規: `tests/features/follow-user/FollowButton.test.tsx`

**コンポーネント:** FollowButton
- Props: `{ targetUserId, currentUserId, initialFollowing }`
- 状態: フォロー中 / 未フォロー
- クリックで follows テーブルに insert / delete
- 楽観的 UI 更新

**DB:** follows テーブル（既存）。RLS ポリシー（既存）。フォロー時の通知トリガー（既存）。

#### 2-2. ファミリー機能（Issue #9 後半）

**ファイル:**
- 新規: `features/manage-family/ui/FamilyButton.tsx`
- 新規: `features/manage-family/index.ts`

**コンポーネント:** FamilyButton
- Props: `{ targetUserId, currentUserId, initialStatus }`
- 4 状態: none / pending_sent / pending_received / accepted
- none → insert (requester_id = currentUserId)
- pending_received → update (status = 'accepted')
- accepted → delete（双方向検索で削除）

**DB:** family_relationships テーブル（既存）。双方向検索:
```
.or(`and(requester_id.eq.${userId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${userId})`)
```

#### 2-3. プロフィール画面（Issue #10）

**ファイル:**
- 修正: `pages/profile/index.tsx`（スタブ → リダイレクト実装）
- 新規: `pages/profile/$userId.tsx`

**機能:**
- `/profile` → 自分のプロフィールにリダイレクト
- `/profile/$userId` → ユーザー情報 + 投稿一覧
- ユーザー情報: Avatar, display_name, bio, フォロワー数, フォロー数
- 他ユーザー: FollowButton + FamilyButton を表示
- 投稿一覧: そのユーザーの投稿を PostCard で表示

**データ取得:** `createServerFn` で users, posts, follows (count), family_relationships を並列取得。

#### 2-4. 通知画面（Issue #11）

**ファイル:**
- 修正: `pages/notifications.tsx`（スタブ → 実装）

**機能:**
- 通知種別ごとのメッセージ:
  - liked: 「{actor} があなたの投稿にいいねしました」
  - followed: 「{actor} があなたをフォローしました」
  - family_requested: 「{actor} がファミリーに招待しました」
  - family_accepted: 「{actor} がファミリー招待を承認しました」
- Actor の Avatar + 名前
- 未読の視覚的区別（背景色）
- 画面表示時に全件既読に更新
- liked 通知には投稿詳細へのリンク

**データ取得:** notifications テーブルから actor の users 情報を JOIN して取得。

---

### フェーズ 3: リリース準備

#### 3-1. PWA 設定（Issue #13）

**ファイル:**
- 新規: `public/manifest.json`
- 修正: `pages/__root.tsx`（head に manifest リンク追加）

**manifest.json:**
```json
{
  "name": "Manna — 聖典学習共有",
  "short_name": "Manna",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "lang": "ja",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**head meta:**
- theme-color, viewport (viewport-fit=cover), apple-mobile-web-app-capable

#### 3-2. 本番デプロイ確認

- Cloudflare Pages デプロイ動作確認
- 本番 Supabase へのマイグレーション適用（scripture_tables 含む）
- 本番 Google OAuth リダイレクト URL 設定
- 本番 DB への聖典データ投入

#### 3-3. 最終チェックリスト

- [ ] ログイン → 投稿作成 → フィードに表示される
- [ ] 投稿詳細画面が正しく表示される
- [ ] 聖典テキストが章ページ・節ページで表示される
- [ ] フォロー / フォロー解除が動作する
- [ ] ファミリー招待 / 承認 / 解除が動作する
- [ ] プロフィール画面にフォロー数・投稿が表示される
- [ ] 通知が表示され既読になる
- [ ] PWA としてホーム画面に追加できる
- [ ] モバイルレイアウトが崩れない
- [ ] 全テスト通過
- [ ] RLS が正しく機能する（公開投稿は見える、非公開は見えない）

---

## 実装順序の依存関係

```
PR #37 マージ
  ├── フィード画面 (#7)
  ├── 投稿詳細画面 (#12)
  ├── 聖典テキスト表示
  │
  ├── フォロー機能 (#9a) ──┐
  ├── ファミリー機能 (#9b) ─┤
  │                         ├── プロフィール画面 (#10)
  │                         └── 通知画面 (#11)
  │
  └── PWA 設定 (#13) → 本番デプロイ
```

## スコープ外（Phase 1）

- いいね機能（likes テーブルは準備済み、Phase 2）
- Chrome 拡張（Phase 2）
- 多言語対応
- プッシュ通知
- 投稿の編集・削除
- 検索機能
