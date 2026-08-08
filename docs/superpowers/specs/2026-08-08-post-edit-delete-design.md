# 投稿の編集・削除導線 設計

## 背景

`posts` の編集・削除は **DB 層だけが完成していて、UI が存在しない**。

- RLS: `posts_update_own` / `posts_delete_own`（`supabase/migrations/20260519000002_rls_policies.sql`）
- `updated_at` 自動更新トリガー: `posts_set_updated_at`（`20260519000003_triggers.sql`）
- `likes.post_id` / `notifications.post_id` はいずれも `ON DELETE CASCADE`

一方でアプリ側は `PostEditor`（`apps/pwa/src/widgets/post-editor/ui/PostEditor.tsx`）が insert 専用で、投稿詳細ページ（`apps/pwa/src/pages/posts/$id.tsx`）にもメニューがない。一度投稿すると、誤字の修正も公開範囲の変更も取り消しもできない。

この機能が解決するのはその一点である。

DB 側で1つだけ足りないものがある。`GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated`（`20260802183557_grant_public_table_privileges.sql`）は**列を指定していない**ため、RLS が「どの行か」しか制限しない以上、本人であれば API を直接叩いて聖典参照や `created_at` まで書き換えられる。後述のとおりトリガーで塞ぐ（マイグレーション1本）。

## スコープ

**含む**

- 投稿詳細ページへの「…」メニュー（編集 / 削除）。自分の投稿のときだけ表示
- 既存シートを再利用した編集 UI（`content` / `visibility`）
- 確認シートを挟んだ削除
- `updated_at` による「編集済み」表示
- `content` / `visibility` 以外の列を更新から守るトリガー（マイグレーション1本）

**含まない**

- 投稿への返信コメント機能（`comments` テーブルは存在しない。別の設計として扱う）
- 聖典参照（コレクション / 書 / 章 / 節）の変更
- フィード・プロフィール・節コメントシートの各カードへのメニュー配置
- 編集履歴の保持、管理者による他人の投稿の削除
- 楽観的排他制御（後述のとおり last-write-wins を採用する）

### 聖典参照を不変にする理由

投稿は「この節への感想」という文脈と一体で表示される。章ページの節バブル（`ChapterCommentersRow` / `VerseCommentSheet`）は `scripture_verses` で投稿を引くため、参照を変更できると読者にとって投稿が別の場所へ瞬間移動する。誤った節を選んで投稿した場合は削除して投稿し直す。

UI で編集させないだけでは足りない。テーブル権限が列を絞っていないため、トリガーで DB 側からも守る（後述）。

### 各カードにメニューを置かない理由

`PostCard` / `CompactPostCard` は `entities/post` にあり、FSD 上 entities は features を import できない。カードにメニューを置くには slot props による注入が必要で、さらに `PostCard` は全体が `<Link>` でラップされているためイベント伝播の回避（既存の `NestedLink` と同種の処理）も要る。加えて削除後の再取得をフィード2タブ / プロフィール / 節シートの4経路ぶん考えることになる。

一方で全カードは `/posts/$id` へリンク済みなので、詳細ページに置けばどこからでも2タップで到達できる。まず詳細ページで導線を通し、「一覧から直接消したい」という要求が実際に出た時点でカードへ広げる。

## 導線と配置

`apps/pwa/src/pages/posts/$id.tsx` の `PageHeader` に既にある `action` スロットを使う。

```tsx
<PageHeader
  title="投稿"
  backTo="/"
  backLabel="フィード"
  action={isOwner ? <PostActionsMenu postId={post.id} onEdit={() => setEditing(true)} /> : undefined}
/>
```

## 新規スライス

ユーザー操作なので FSD 上 `features/` に置く。

```
apps/pwa/src/features/manage-post/
  index.ts                    ← export { PostActionsMenu }
  ui/PostActionsMenu.tsx      ← 「…」ボタン + Popover メニュー + 削除シート
  ui/DeletePostSheet.tsx      ← 削除確認シート
  model/useDeletePost.ts      ← 削除 mutation + キャッシュ無効化 + 遷移
```

### 層の制約から生じる3つの決定

**① 編集はコールバックで外に出す**

features は widgets を import できない。`PostComposerSheet` は widgets なので、`PostActionsMenu` から直接開けない。

`PostActionsMenu` は props に `onEdit: () => void` を取り、シートの開閉状態はページが持つ。削除はメニュー内で完結する（外に出す必要がない）。

```tsx
type Props = { postId: string; onEdit: () => void }
```

**② 更新処理は `PostEditor` の中に置く**

`PostEditor`（widgets）は insert を自前で書いている。update を features 側に切り出すと widgets → features の依存が増えるだけで、対称性も失われる。insert と同じ場所に update を置く。

**③ キャッシュ無効化は entities 層に置く**

`PostEditor`（widgets）と `useDeletePost`（features）の両方から呼ぶ必要がある。両者が共通して import できるのは entities 以下だけ。

`apps/pwa/src/entities/user/model/relationQueries.ts` に `FEED` / `USER_POSTS` の定数と `invalidateRelationQueries` が既にあるので、同じファイルに追加する。

```ts
// 投稿の作成・編集・削除で古くなる一覧。個別の tab / userId を知る必要がないよう
// プレフィックスで無効化する
export function invalidatePostLists(queryClient: QueryClient) {
  return Promise.all(
    [USER_POSTS, FEED].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  )
}
```

`apps/pwa/src/entities/user/index.ts` から export する。

## 列の不変性を DB で守る（マイグレーション）

`supabase/migrations/20260808000001_protect_post_immutable_cols.sql` を追加する。

```sql
-- posts は content / visibility 以外を更新できないようにする。
-- GRANT は列を指定せず UPDATE を許しており、RLS は「どの行か」しか制限しない。
-- 聖典参照を後から変えられると、章ページの節バブルから見て投稿が別の節へ移動する。
-- RLS の WITH CHECK では OLD を参照できないためトリガーで守る
-- （family_relationships / notifications と同じ手法）。
CREATE OR REPLACE FUNCTION public.protect_post_immutable_cols()
RETURNS trigger AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.user_id IS DISTINCT FROM NEW.user_id
    OR OLD.scripture_collection IS DISTINCT FROM NEW.scripture_collection
    OR OLD.scripture_book IS DISTINCT FROM NEW.scripture_book
    OR OLD.scripture_chapter IS DISTINCT FROM NEW.scripture_chapter
    OR OLD.scripture_verses IS DISTINCT FROM NEW.scripture_verses
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'only content and visibility may be updated on posts';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER posts_protect_immutable
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.protect_post_immutable_cols();
```

`updated_at` はこのトリガーの検査対象に含めない。同じ `BEFORE UPDATE` の `posts_set_updated_at` が書き換えるためで、トリガーは名前順に実行されるので `posts_protect_immutable` → `posts_set_updated_at` の順になる。

列単位の `GRANT UPDATE (content, visibility)` ではなくトリガーを選んだのは、既存の2つの不変列保護（`protect_family_immutable_cols` / `protect_notification_immutable_cols`）と手法を揃えるため。エラーメッセージが返る点も、権限エラーより原因が分かりやすい。

## 所有者判定

`pages/posts/$id.tsx` の `fetchPost` は現在 post だけを返す。viewer の id を足す。

```ts
const [{ data: post }, { data: { user } }] = await Promise.all([
  serverSupabase.from('posts').select(POST_SELECT).eq('id', ctx.data.id).maybeSingle().throwOnError(),
  serverSupabase.auth.getUser(),
])
return { post: post as PostWithUser | null, viewerId: user?.id ?? null }
```

loader は `post` が null なら従来どおり `notFound()` を投げ、そうでなければ `{ post, viewerId }` を返す。

SSR 時点で判定が確定するため、メニューが後から現れるちらつきが起きない。

セキュリティ上の実効性は RLS が担保する。この判定は UI の出し分けだけを担う。

## 編集フロー

1. 「…」→「編集」→ ページの `editing` が `true` になる
2. `PostComposerSheet` が `post` prop 付きで開く
3. `PostEditor` が編集モードで初期値を表示する
4. 「更新する」→ update
5. 成功 → シートを閉じる → `router.invalidate()` + `invalidatePostLists(queryClient)`

### `PostEditor` の編集モード

`EditablePost` 型は `entities/post/model.ts` に定義し、`entities/post/index.ts` から export する（`PostEditor` / `PostComposerSheet` / 詳細ページの3箇所で使うため）。

```ts
// entities/post/model.ts
export type EditablePost = { id: string; content: string; visibility: Visibility }
```

```ts
// widgets/post-editor/ui/PostEditor.tsx
type Props = {
  initialScripture?: ScriptureRefPartial
  mode?: 'page' | 'sheet'
  post?: EditablePost   // 渡されたら編集モード
  onSuccess?: () => void
}
```

| 項目 | 新規投稿 | 編集 |
|---|---|---|
| 初期値 | ドラフト or 空 | `post.content` / `post.visibility` |
| localStorage ドラフト | 読む・書く・成功時に消す | **一切触らない** |
| 聖典参照 | `ScriptureSelector`（編集可） | 読み取り専用チップ（参照が無ければ非表示） |
| 公開範囲 | `VisibilitySelector` | `VisibilitySelector` |
| ボタン | 投稿する / 投稿中... | 更新する / 更新中... |
| ボタンの無効化 | 本文が空のとき | 本文が空 **または** `content` / `visibility` が初期値と同一のとき |
| 送信 | `insert` | `update({ content, visibility }).eq('id', post.id).select('id')` |

未変更のまま「更新する」を押せると `posts_set_updated_at` が発火して「編集済み」が空振りする。編集モードでは差分が無い間ボタンを無効化する。

聖典参照チップの元データは `initialScripture` を使う。詳細ページが `toScriptureRef(post)` の結果をそのまま `PostComposerSheet` に渡し、`PostEditor` へ素通しする。参照の無い投稿では `toScriptureRef` が `null` を返すのでチップを描画しない。

**ドラフトを一切触らない理由**: 現在のドラフトキーは聖典参照から導出される（`scriptureDraftKey`）。編集モードでも同じキーを使うと、同じ節に対して書きかけの新規投稿があった場合、編集画面を開いた瞬間にそれが既存投稿の本文で上書きされ、閉じるときにも上書きされる。編集は「今開いている1件」に閉じた操作なので、そもそも永続化しない。

編集中にシートを閉じた場合、入力は破棄する。破棄確認は挟まない — 元の投稿は残っているので損失が小さく、`PostComposerSheet` の history 制御（ブラウザバック経由の close）と確認シートが絡むと制御が複雑になるため。

### 並行編集

同じ投稿を複数の端末で同時に編集した場合は **last-write-wins**（後から保存したほうで上書き）とする。自分の投稿を自分だけが編集する機能なので衝突頻度が低く、`updated_at` による楽観的排他制御はエラー復帰 UI の分だけ複雑さが増す。実装上は何もしない（`update` に `updated_at` の条件を付けない）という選択であり、意図した挙動である。

### `PostComposerSheet` の変更

```ts
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialScripture?: ScriptureRefPartial
  post?: EditablePost
  onClosed?: () => void
}
```

- `post` があればタイトルを **「投稿を編集」固定**にする。聖典ラベルをタイトルに出すと編集中であることが伝わらないため、参照は `PostEditor` 内のチップに寄せる
- `post` をそのまま `PostEditor` へ渡す
- history 制御（`mannaComposer` マーカーによる push / back）は変更しない。編集シートでもブラウザバックで閉じられる

## 削除フロー

1. 「…」→「削除」→ 確認シートが開く
2. 「削除する」→ ボタンを `pending` にして `delete().eq('id', postId).select('id')`
3. 成功 → `toast('投稿を削除しました')` → `invalidatePostLists(queryClient)` → 直前の画面へ戻る
4. 失敗 → `pending` を解除してシートは開いたまま残し、再試行できるようにする（`SignOutButton` と同じ形）

### 戻り先

```ts
if (router.history.canGoBack()) router.history.back()
else navigate({ to: '/' })
```

`/` 固定にしないのは、章を読みながら節コメントシート経由で開いた投稿を削除したときに読書位置を失うため。章ページはルートローダーで投稿を引いており、戻ると再取得されて削除済みの投稿が消える。

`canGoBack()` は `@tanstack/history` が提供する（`useRouter().history`）。実装は `location.state[stateIndexKey] !== 0` で、ブラウザ履歴の生の長さではなく **TanStack が自前で管理する index** を見ている。外部サイトからの流入や直リンクでは index が 0 なので `false` になり `/` へ送られる。アプリ外へ戻ることはないので、追加のフォールバックは不要。

### 確認 UI に Sheet を使う

既存の `Sheet`（`apps/pwa/src/shared/ui/sheet.tsx`、Base UI の Dialog）を `side="bottom"` で使い、`SignOutButton`（`features/sign-out/ui/SignOutButton.tsx`）と同じ構成にする。

`2026-07-26-sign-out-design.md` は「破壊的操作の確認が2つ目に現れた時点で AlertDialog の導入を検討する」としており、本件がその2つ目にあたる。それでも Sheet を選ぶ理由は、このアプリの確認的なやり取りが `SignOutButton` / `IosInstallInstructionsDialog` / `PostComposerSheet` / `VerseCommentSheet` とすべて Sheet に統一されており、確認 UI が2種類に割れるコストのほうが大きいため。`SheetTitle` / `SheetDescription` を使うのでスクリーンリーダーへの見出しと説明は担保される。

| 要素 | 内容 |
|---|---|
| `SheetTitle` | 投稿を削除しますか？ |
| `SheetDescription` | 削除した投稿は元に戻せません |
| 主ボタン | 削除する（`variant="destructive"`） |
| 副ボタン | キャンセル（`SheetClose`） |

### 「…」メニュー

既存の `Popover`（`shared/ui/popover.tsx`、Base UI）を使う。`ComposeMenu` はモバイルで Sheet / デスクトップで Popover に出し分けているが、項目が2つだけのアクションメニューにその出し分けは要らない。

詳細ページのヘッダーは `<Link>` の内側ではないため、`PostCard` で必要だったイベント伝播の回避は不要。

- トリガー: `MoreHorizontal`（lucide）、`aria-label="投稿の操作"`、`aria-haspopup="menu"`
- 項目: 編集（`Pencil`）/ 削除（`Trash2`、`var(--destructive)` 系の文字色）
- 項目クリック時は Popover を閉じてから処理へ進む（`ComposeMenu` と同じ）

確認シートは **Popover の外**に置き、`open` を state で制御する。`SignOutButton` のような `SheetTrigger` 方式は使えない — Popover を閉じると中身が unmount され、トリガーごとシートが消えるため。

## 「編集済み」表示

`POST_SELECT`（`entities/post/model.ts`）に `updated_at` を追加し、`PostWithUser` に `updated_at: string` を足す。

投稿詳細ページで、`post.updated_at !== post.created_at` のとき投稿日時の隣に「編集済み」を出す。

```tsx
{formatDate(post.created_at, { year: true })}
{post.updated_at !== post.created_at && <span>・編集済み</span>}
```

`updated_at` はトリガーで必ず更新されるので、アプリ側で書き込む必要はない。カード側（`PostCard` / `CompactPostCard`）には出さない。一覧の情報密度を上げてまで伝える必要のある情報ではない。

## エラー処理

| 失敗 | 挙動 |
|---|---|
| 更新エラー | `PostEditor` 既存の `errorMessage` に「更新に失敗しました。もう一度お試しください。」 |
| 更新が 0 行 | 同上。RLS で他人の投稿を更新しても**エラーにならず 0 行が返る**ため、`.select('id')` の返り行数で判定する |
| 削除エラー | `toast.error('削除に失敗しました')`。確認シートは開いたまま残し再試行できるようにする |
| 削除が 0 行 | 別セッションで既に削除済みか、他人の投稿。`toast('投稿は既に削除されています')` を出して戻り先へ遷移する（削除の意図は達成されているのでエラー扱いにしない） |
| 更新が制限列に触れた | トリガーが例外を投げるので通常の更新エラーとして扱う。UI は `content` / `visibility` しか送らないので通常は起きない |
| 削除済み投稿を開く | 既存の `notFound()` がそのまま効く |

`Toaster` は `pages/__root.tsx` に設置済みなので追加不要。

## テスト

CLAUDE.md の方針どおり TDD（失敗テスト → 実装 → 通過）で進める。テストは `apps/pwa/tests/` 下に置く。

| ファイル | 検証する挙動 |
|---|---|
| `tests/features/manage-post/PostActionsMenu.test.tsx` | 「編集」で `onEdit` が呼ばれる / 「削除」は確認シートを挟む / 確認して初めて delete が呼ばれる / キャンセルで呼ばれない |
| `tests/widgets/post-editor/PostEditor.test.tsx` | 編集モードで `post` の値が初期表示される / localStorage を読み書きしない / ボタンが「更新する」になる / update が `{ content, visibility }` と `id` で呼ばれる / 0 行返却でエラーメッセージが出る |
| `tests/widgets/post-composer-sheet/PostComposerSheet.test.tsx` | `post` があるときタイトルが「投稿を編集」になる |
| `tests/pages/posts/detail.test.tsx` | `viewerId === post.user_id` のときだけメニューが出る / `updated_at !== created_at` のとき「編集済み」が出る |

`tests/helpers/fixtures.ts` の `makePost` に `updated_at` を追加する。`PostWithUser` が必須フィールドを1つ増やすため、これを直さないと既存テストが型エラーになる。既定値は `created_at` と同じ値にして「未編集」を表す。

### DB レベルのテストは行わない

トリガーによる列不変性、RLS の所有者判定、`likes` / `notifications` の CASCADE はいずれも自動テストで検証しない。このリポジトリには pgTAP も `supabase/tests/` も無く、`pnpm test` は Vitest だけを走らせる。DB テスト基盤の新設は本件のスコープを超える。

トリガーの動作は `bash scripts/db-reset.sh` 後に手動で確認する（他の列を含む UPDATE が例外になること、`content` / `visibility` のみの UPDATE が通ること）。DB テスト基盤が無い点は残課題として記録しておく。

## 変更ファイル一覧

**新規**

- `apps/pwa/src/features/manage-post/index.ts`
- `apps/pwa/src/features/manage-post/ui/PostActionsMenu.tsx`
- `apps/pwa/src/features/manage-post/ui/DeletePostSheet.tsx`
- `apps/pwa/src/features/manage-post/model/useDeletePost.ts`
- `supabase/migrations/20260808000001_protect_post_immutable_cols.sql`
- 上記に対応するテスト

**変更**

- `apps/pwa/src/pages/posts/$id.tsx` — viewerId 取得 / メニュー配置 / 編集シート / 「編集済み」表示
- `apps/pwa/src/widgets/post-editor/ui/PostEditor.tsx` — 編集モード
- `apps/pwa/src/widgets/post-composer-sheet/ui/PostComposerSheet.tsx` — `post` prop とタイトル
- `apps/pwa/src/entities/post/model.ts` — `POST_SELECT` に `updated_at`、`PostWithUser` に `updated_at`、`EditablePost` 型
- `apps/pwa/src/entities/post/index.ts` — `EditablePost` の export 追加
- `apps/pwa/src/entities/user/model/relationQueries.ts` — `invalidatePostLists`
- `apps/pwa/src/entities/user/index.ts` — export 追加
- `apps/pwa/tests/helpers/fixtures.ts` — `makePost` に `updated_at`
- `packages/database/index.ts` — マイグレーション追加後に `pnpm supabase:types` で再生成

**変更なし**

- 既存の RLS ポリシー・FK 制約（行レベルの所有者判定と CASCADE は既存で足りる。足りなかったのは列レベルの制限だけ）

## 本件では扱わない既存の課題

実装中に見えたが、この設計の範囲外として記録しておく。

- **widget → widget の依存**: `PostComposerSheet` が `@/widgets/post-editor` を import している。CLAUDE.md の表に widgets → widgets は無く、FSD 上も同一層のスライス間 import は本来禁止。本件で新たに作る違反ではないため触らない。解消するなら両スライスの統合か、ページ層での合成になる。
- **キャッシュキーの置き場所**: `FEED` / `USER_POSTS` の定数が `entities/user/model/relationQueries.ts` にある。投稿一覧のキーとしては `entities/post` にあるほうが自然だが、移動は `invalidateRelationQueries` の利用側にも波及するため別途。
- **DB レベルのテスト基盤が無い**: 上記のとおり。RLS とトリガーの回帰を自動で守れない状態が続く。
