# フィードとプロフィール投稿一覧のページネーション（#82 / #70）

## 背景

主要な一覧が固定件数で打ち止めで、21 件目より古い投稿にアプリ内から到達できません。フォロー/ファミリー一覧（#67）だけが keyset pagination + 「もっと見る」を持っています。

同じファイルを書き換えるため、#70（Supabase の `error` を見ておらず障害が「0 件」として描画される）の一覧系クエリも同時に対応します。

## スコープ

| 対象 | 変更 |
|---|---|
| フィード「フォロー中」/「全体」 | `useInfiniteQuery` + keyset ページング、タブを `?tab=` に |
| プロフィール投稿一覧 | 同上。プロフィール本体のクエリから投稿を切り出す |
| 通知（50 件） | ページングはしない。`error` を見るだけ |
| `getCircleUserIds` | `error` を見るだけ |

通知をページングしないのは #82 の判断（優先度低）に従ったもの。加えて、通知はマウント時に「読み込んだ未読を既読にする」副作用があり、ページングすると「どこまで既読にするか」という別の仕様判断が要ります。

## 設計

### 1. server function

connections（#67）と同じ keyset 方式で 2 つ追加する。

```ts
// pages/index.tsx        queryKey: ['feed', tab]
fetchFeed({ tab, cursor })
// pages/profile/$userId/index.tsx   queryKey: ['user-posts', userId]
fetchUserPosts({ userId, cursor })
```

並びは `created_at DESC, id DESC`。カーソル条件は connections と同形。

```
created_at.lt."<createdAt>",and(created_at.eq."<createdAt>",id.lt."<id>")
```

`PAGE_SIZE + 1` 件取って次ページの有無を判定し、`nextCursor` を返す。

「フォロー中」タブはページごとに follows の id 一覧を取り直す（1 ページあたり +1 クエリ）。PostgREST はサブクエリを書けないため、避けるには RPC かビューが要る。ページサイズ 20 に対して割に合わないので取り直す。

可視性は RLS が担う。「フォロー中」タブは `visibility` で絞らず `.in('user_id', ids)` のみ（現状どおり）。

### 2. プロフィールの分割

`fetchProfileData` から投稿を外す。

- `fetchProfileData({ userId })` — プロフィール行 / currentUserId / 関係 / 件数
- `fetchUserPosts({ userId, cursor })` — 投稿ページ

`invalidateRelationQueries` が落とすのは `['profile']` のままなので、フォロー操作で件数は更新され、投稿は再取得されない。#85 のプロフィール側がこれで解消する。

### 3. カーソル型

`Cursor` のフィールド `otherId` を `id` に改名する。connections 専用の名前のままだと投稿側で「相手の id」と読めてしまう。値の検証（UUID + ISO timestamp）は両者で共通。

### 4. インデックス

`posts` に該当するものが無いので 1 本追加する。

```sql
CREATE INDEX posts_public_created_idx ON posts (visibility, created_at DESC, id DESC);
CREATE INDEX posts_user_created_idx   ON posts (user_id, created_at DESC, id DESC);
DROP INDEX posts_user_id_idx;
```

`posts_user_id_idx` を落とすのは、追加する複合インデックスが先頭列で同じ用途を満たすため。

### 5. エラー処理（#70）

supabase-js 組み込みの `.throwOnError()` を一覧系クエリに付ける。対象はフィード 3 クエリ、プロフィール（投稿・件数）、通知、`getCircleUserIds` 3 クエリ。connections が持っていた自作の `unwrap()` は不要になるので削除する。

`.throwOnError()` はクエリ単位でしか有効にできない（`createClient` に相当するオプションは無く、postgrest-js のソースにも `// TODO: Add back shouldThrowOnError once we figure out the typings` が残っている）。付け忘れると握り潰しに戻る点は自作ヘルパーと同じ。

`.maybeSingle()` と組み合わせたとき、複数行にマッチしたケースだけは throw せず `{ error: PGRST116 }` を返す（型は `error: null` と主張する）。本プロジェクトの `.maybeSingle()` 3 箇所はいずれも主キーで絞っており複数行にならないため影響しない。

`.single()` の 2 箇所（`posts/$id.tsx`、プロフィール行）には付けない。今の握り潰しが「行 0 件 → `null` → `notFound()` で 404」を成立させており、`.single().throwOnError()` は 0 件で PGRST116 を throw するため 404 が 500 に退行する（#70 に明記されている。ローカルで実測して確認済み）。

これで #70 の「一覧系のみ対応」が全部埋まるため、#70 はクローズできる。

### 6. UI

どちらも connections と同じ「もっと見る」ボタン（#82 の「既存に合わせるならボタン」）。フィードのタブは `?tab=` になり、既定は現状どおり「フォロー中」。

## テスト

| ファイル | 内容 |
|---|---|
| `tests/pages/feed.test.tsx` | 書き換え。タブごとの取得、「もっと見る」で追記、カーソルの受け渡し、タブ切り替えで混ざらない |
| `tests/pages/profile/index.test.tsx` | 更新。プロフィール本体と投稿が別クエリになる |
| `tests/shared/lib/cursor.test.ts` | フィールド改名に追従 |

connections のテストで確立した形（`renderWithQueryClient` + server function のモック）に揃える。

## 検証

- `bash scripts/db-reset.sh` でマイグレーションを適用（`npx supabase db reset` は節データが消えるため使わない）
- 投稿を 25 件以上積み、Playwright で確認する
  - フィード両タブで「もっと見る」を押すと 21 件目以降が出る
  - タブを切り替えても前タブの行が混ざらない
  - プロフィールでフォローしても投稿一覧が再取得されない（#85 の半分）

## スコープ外

- 通知のページネーション（別 issue に残す）
- connections の全ページ再取得（#85 の残り半分）
- `staleTime` / プリロード設定の調整（#86）
