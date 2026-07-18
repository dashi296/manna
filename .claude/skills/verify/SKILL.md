---
name: verify
description: Manna PWA の変更をローカルで実機検証する手順（Supabase ローカル + Vite dev + Playwright MCP）
---

# Manna 検証レシピ

## 前提確認

```bash
npx supabase status          # "running" であること。止まっていたら: npx supabase start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -t -A \
  -c "SELECT count(*) FROM scripture_verses;"   # 41,959 行あれば節データ復元済み
```

節データが 0 の場合は `bash scripts/db-reset.sh`（`npx supabase db reset` 直接実行は禁止 — 節データが消える）。

## 起動

```bash
cd apps/pwa && pnpm dev   # バックグラウンド実行。ポート 3000 が使用中だと 3001/3002 に逃げる
```

出力の `Local: http://localhost:PORT/` を必ず確認し、そのポートを使う（別ポートに古いサーバーが残っていることがある）。

## 認証

- Google OAuth のみ。Playwright MCP の永続プロファイルに開発者のログインセッションが残っていることが多く、そのまま認証済みで検証できる。
- 未ログイン検証: `/scriptures/*` は閲覧可、`/`・`/posts/new`・`/profile`・`/notifications` は `/login` にリダイレクトされる。

## 検証に使える主要フロー

- 章ページ: `/scriptures/bofm/1-ne/3`（節一覧・ルビ付き本文・投稿件数バッジ = fetchChapterData）
- 節ページ: `/scriptures/bofm/1-ne/3?verses=%5B7%5D`（節本文 + 投稿一覧 = fetchVerseData）
- 投稿作成: 節ページの「投稿する」→ PostEditor（聖典参照が URL からプリフィルされる）
- サーバー関数の呼び出し回数は Network タブの `/_serverFn/<base64>` で確認できる（base64 に関数名が入っている）

## 後始末

- テスト投稿は DB から削除: `psql ... -c "DELETE FROM posts WHERE id='<uuid>';"`
- 起動した dev server は必ず停止する

## 既知の注意点

- コンソールに `data-tsd-source` 属性の hydration mismatch エラーが常時1件出る（TanStack devtools 由来の開発時ノイズ。実害なし）
- vitest 実行時の「Not implemented: Window's open() method」は jsdom の制約で無害
