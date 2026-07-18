# Phase 2 移行ハンドオフ（2026-07-18）

新しいセッション・コンテキストで Phase 2 を開始するための引き継ぎドキュメント。

## Phase 1 の完了状態

- **PR #37 で main にマージ済み**（マージコミット `90ab1b4`、2026-07-18）
- 実装済み機能: 投稿作成（PostEditor / 聖典参照選択 / 公開範囲）、フィード（フォロー中・全体タブ）、投稿詳細、聖典閲覧（41,959節・ルビ付き本文・節ごとの投稿件数）、フォロー、ファミリー（双方向リクエスト）、プロフィール、通知、PWA 設定
- テスト: vitest 80件 + `scripts/lib/parse-verses.test.mjs` 10件、tsc クリーン、vite build 成功
- E2E 検証手順は `.claude/skills/verify/SKILL.md` に永続化済み（Supabase ローカル + Playwright MCP）
- コード品質: /simplify 3巡 + Codex レビュー2回を通過（サーバー関数のページ単位統合、entities/family スライス、DB enum からの型導出などを適用済み）

## Phase 2 のスコープ

出典: `docs/superpowers/specs/2026-05-19-manna-design.md` の「Phase 2: Chrome拡張」

- **Plasmo** フレームワークで Chrome 拡張を実装
- 公式聖典サイト（churchofjesuschrist.org）の URL を解析して書籍・章・節を自動抽出
- サイドパネルまたはポップアップで投稿フォームを表示
- 同じ Supabase バックエンドに投稿（認証共有）

## Phase 2 で再利用できる資産

| 資産 | 場所 | 用途 |
|---|---|---|
| `PostWithUser` / `POST_SELECT` / `toScriptureRef` / `Visibility` | `apps/pwa/src/entities/post` | 投稿の型・SELECT 句 |
| `parseVerses` / `ScriptureRefPartial` | `apps/pwa/src/features/select-scripture/model.ts` | 節指定のパース |
| `buildScriptureUrl` / `getScriptureLabel` / `scriptures.json` | `apps/pwa/src/shared/lib/scriptureUtils.ts` + `shared/config` | 聖典 URL・ラベル（拡張では**逆変換**＝URL→ref の実装が必要） |
| `Database` 型 | `packages/database` | Supabase スキーマ型（workspace パッケージなので拡張からも参照可） |
| 投稿 INSERT の形 | `apps/pwa/src/widgets/post-editor/ui/PostEditor.tsx` の `handleSubmit` | 拡張の投稿処理の参考 |

モノレポ構成のため、拡張は `apps/extension` として追加するのが自然（pnpm workspace 登録を忘れずに）。

## 見送った改善候補（レビュー指摘・着手時に検討）

品質レビューで指摘されたが、挙動変更・製品判断・DB マイグレーションを伴うため意図的に見送ったもの:

1. **`defaultPreloadStaleTime: 0`**（`apps/pwa/src/router.tsx`）— intent preload がホバーごとにローダーを再実行する。TanStack デフォルト（30秒）に戻すか明示設定を検討
2. **章ルートへの `staleTime`** — 章↔節の往復ナビゲーションで不変の聖典本文を毎回再取得している
3. **`auth.getUser()` → `getSession()`/`getClaims()`** — フィード等のローダーで認証サーバーへのネットワーク往復が発生。RLS 前提ならローカル読み取りで十分
4. **聖典ページの投稿ページネーション** — 現状は全件表示（`.limit(20)` は Codex 指摘で撤回済み）。投稿数が増えたら「もっと見る」導線とセットで導入
5. **PostEditor の `useSupabaseAction` 化** — pending 解除タイミングが変わり、ナビゲーション中にボタンが一瞬再活性化するため見送り
6. **posts/new の検索パラメータ2段パースの1段化**（`SearchSchemaInput`）
7. **聖典参照 URL の serialize/parse ペアの `entities/scripture` への集約** — Phase 2 の URL 抽出実装と関連が深いので、そのタイミングでの整理を推奨
8. **`resolveUserIdentity` の `entities/user` 化** — entity 間 import 規約（現状 entities→shared のみ可）の整理が前提
9. **`ScriptureText` の `entities/scripture/ui` への移動** — `SanitizedVerseHtml` との分割設計が必要

## 開発環境の注意（ハマりどころ）

- DB リセットは必ず `bash scripts/db-reset.sh`（`npx supabase db reset` 直接実行は節データが消える）
- `supabase/seed.sql` は `node scripts/export-books-seed.mjs` で `scriptures.json` から生成する（手動編集しない）
- 開発サーバー稼働中は `routeTree.gen.ts` が自動再生成されるため、ブランチ切り替え・pull の際は dev server を止める（Phase 1 マージ時にこれで pull がブロックされた実績あり）
- 検証の詳細手順は `.claude/skills/verify/SKILL.md`
