# フォロー/ファミリー操作を useMutation に載せ替える（#81）

## 背景

`FollowButton` と `FamilyButton` は操作結果をローカル state にしか反映していない。同じデータを表示している他の箇所が更新されず、`useSupabaseAction` はエラーを握り潰して成功と区別がつかない。

読み取り面を洗い出すと、直す必要があるのは「同じ画面に残る古いデータ」だけだった。

| 表示 | 取得方法 | フォロー変更の影響 |
|---|---|---|
| プロフィール（フォロワー数・フォロー状態・ファミリー状態） | route loader | 同一画面で古いまま ← 本命 |
| connections 一覧 | `useInfiniteQuery` | 同一画面で行がずれる |
| フィード「フォロー中」 | route loader | 別ルートの loader は遷移ごとに再実行されるため問題なし |
| 章ページ（`getCircleUserIds`） | route loader | 同上 |

## 方針

プロフィールページを query 化し、ミューテーションからは `invalidateQueries` だけを撃つ。

`router.invalidate()` は採らない。connections の loader は `pages: 1` で 1 ページ目だけを取り直す（PR #83 の意図的な選択）ため、`router.invalidate()` が走ると「もっと見る」で読み込んだ 2 ページ目以降が切り捨てられ、60 件表示中にフォローすると 20 件へ縮む回帰が入る。

## 設計

### 1. 無効化対象を一箇所で宣言する

`src/shared/lib/invalidateRelationQueries.ts` を新設する。

```ts
export function invalidateRelationQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['profile'] }),
    queryClient.invalidateQueries({ queryKey: ['connections'] }),
  ])
}
```

`shared` に置く理由は、`features/follow-user` と `features/manage-family` の両方が同じ集合を無効化する必要があり、feature 同士は import できないため。

userId を含めないプレフィックス無効化にするのは、「相手のプロフィールでフォローすると自分のフォロー中数も変わる」を取りこぼさないため。

### 2. プロフィールページを query 化する

`src/pages/profile/$userId/index.tsx` を connections と同じ形に揃える。

```ts
const profileQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfileData({ data: { userId } }),
  })
```

- loader: `fetchQuery({ ...options, staleTime: 0 })`。`staleTime: 0` は別画面での変更後に戻ったとき古い値を出さないため。結果が `null` なら `notFound()`
- component: `useQuery(profileQueryOptions(userId))`

`fetchFeed` や章ページは loader ベースのまま触らない。

### 3. ボタンをローカル state から prop 主導へ

`features/follow-user/model/useToggleFollow.ts`（feature 内部に留め、`index.ts` からは公開しない）。

```ts
mutationFn: async (next: boolean) => {
  const { error } = next ? await insert() : await remove()
  if (error) throw error
},
onSuccess: () => invalidateRelationQueries(queryClient),
onError: () => toast.error('フォローを更新できませんでした'),
```

`FollowButton` は `initialFollowing` → `isFollowing` に改名して `useState` を捨てる。

```tsx
const { mutate, isPending, variables } = useToggleFollow(currentUserId, targetUserId)
const following = isPending ? variables : isFollowing
```

`onSuccess` が再取得の Promise を返すため `isPending` は再取得完了まで立ったままになり、楽観表示から実データへ切り替わる瞬間にラベルが戻るちらつきが起きない。

`FamilyButton` も同型。ミューテーションの変数を `'request' | 'accept' | 'remove'` にし、`NEXT_STATUS` マップで楽観表示先を決める。エラー文言は操作ごとに出し分ける。

`useSupabaseAction` は利用箇所が 0 になるので削除する。

### 4. エラー表示

`shared/ui/sonner.tsx` は導入済みだがどこにもマウントされていない。`__root.tsx` に `<Toaster position="top-center" />` を置く。BottomNav が下部を占めるため上寄せにする。

## テスト

| ファイル | 内容 |
|---|---|
| `tests/features/follow-user/FollowButton.test.tsx` | 更新。prop 名、楽観表示、失敗時にトーストが出て表示が元に戻る、成功時に該当 queryKey が無効化される |
| `tests/features/manage-family/FamilyButton.test.tsx` | 新規。4 状態の描画、3 操作それぞれの Supabase 呼び出し、失敗時のトースト |
| `tests/pages/profile/index.test.tsx` | 更新。`useLoaderData` から `useQuery` + `QueryClientProvider` へ |

ボタンのテストに `QueryClientProvider` が必要になるため、`tests/helpers/tanstack.tsx` にラッパーを足して connections のテストと共用する。

## 検証

- `pnpm test` / `pnpm typecheck` / lint
- ローカル実機（`/verify`）で 2 点を確認する
  - プロフィールでフォローすると、同じ画面のフォロワー数が増える
  - connections で 40 件読み込んだ後にフォローしても、行が 20 件に縮まない

## スコープ外

- フィード・プロフィール投稿一覧のページネーション（#82）
- 通知一覧
