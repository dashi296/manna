# フォロー中/フォロワー一覧ページ 設計

- Issue: #66
- PR: #67

## 背景

`/profile/$userId` には「フォロワー」「フォロー中」の件数が表示されているが（`apps/pwa/src/pages/profile/$userId.tsx:108-115`）、クリックしても一覧は開かない。

他人のプロフィールへ辿り着く導線自体が、現状ほぼ通知経由（自分の投稿へのいいね／フォローされた／家族申請を受けた、いずれも `supabase/migrations/20260519000003_triggers.sql` のトリガーで発生）に限定されている。一度誰かのプロフィールに辿り着いても、そこから「その人がフォローしている人」「その人をフォローしている人」を辿って他のユーザーに到達する手段がなく、投稿を介さないフォローの起点が乏しい。

この spec は、フォロー中/フォロワーの一覧を閲覧できるようにすることで、既存のフォローグラフを辿れるようにする改善を扱う。

## スコープ

**含む**: フォロー中/フォロワー一覧ページの追加。

**含まない（別issueで検討）**:
- 家族一覧ページの新設
- ユーザー検索/ディレクトリ（プライバシー考慮が必要なため別途設計する）

## ルーティングとデータ取得

- 新規ルート: `pages/profile/$userId/connections.tsx` → `/profile/$userId/connections`
- タブは `?tab=followers|following` の search param で管理（TanStack Router の `validateSearch` で `'followers' | 'following'` に型を絞る）。デフォルトは `followers`
- `profile/$userId.tsx` の「フォロワー」「フォロー中」の `<span>` 表示を `<Link to="/profile/$userId/connections" params={{ userId: profile.id }} search={{ tab: 'followers' }}>` / `search={{ tab: 'following' }}` に変更する
- 認証ガードは既存の `AUTH_REQUIRED_PREFIXES`（`/profile` prefix）でカバーされるため追加対応は不要。ログインしていれば誰でも閲覧可能とする（`follows` テーブルは RLS 上 `follows_select_all` により既に全ユーザーに公開されており、フォロワー/フォロー中件数も現状誰でも見られるため、一覧を見せることによる新たなプライバシー上の後退はない）

### サーバー関数 `fetchConnections`

`fetchProfileData`（同ファイル内の既存パターン）と同様に `createServerFn` で新設する。

`follows` テーブルは `follower_id` / `following_id` の2本の外部キーで `users` を参照しているため（`supabase/migrations/20260519000001_initial_schema.sql:34-40`）、PostgREST の埋め込みで曖昧にならないよう、タブごとに参照する列を分けて素朴に2クエリで組み立てる（`follows` 行の取得と、相手ユーザー情報の取得を分離する）。

```ts
const fetchConnections = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    userId: string
    tab: 'followers' | 'following'
    cursor: string | null
  }) => data)
  .handler(async (ctx) => {
    const { userId, tab, cursor } = ctx.data
    const serverSupabase = await createSupabaseServer()
    const otherIdColumn = tab === 'followers' ? 'follower_id' : 'following_id'
    const ownIdColumn = tab === 'followers' ? 'following_id' : 'follower_id'

    let query = serverSupabase
      .from('follows')
      .select(`created_at, ${otherIdColumn}`)
      .eq(ownIdColumn, userId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1)

    if (cursor) query = query.lt('created_at', cursor)

    const { data: followRows } = await query
    const hasMore = (followRows?.length ?? 0) > PAGE_SIZE
    const page = (followRows ?? []).slice(0, PAGE_SIZE)
    const otherIds = page.map((r) => r[otherIdColumn] as string)

    const { data: { user: currentUser } } = await serverSupabase.auth.getUser()

    const [{ data: users }, { data: myFollows }] = await Promise.all([
      serverSupabase.from('users').select('*').in('id', otherIds),
      currentUser
        ? serverSupabase.from('follows').select('following_id').eq('follower_id', currentUser.id).in('following_id', otherIds)
        : Promise.resolve({ data: [] }),
    ])

    const followingSet = new Set((myFollows ?? []).map((f) => f.following_id))
    const usersById = new Map((users ?? []).map((u) => [u.id, u]))

    return {
      rows: page.map((r) => ({
        user: usersById.get(r[otherIdColumn] as string),
        isFollowingByMe: followingSet.has(r[otherIdColumn] as string),
      })),
      nextCursor: hasMore ? page[page.length - 1].created_at : null,
    }
  })
```

- `PAGE_SIZE = 20`（投稿一覧 `limit(20)` に合わせる）
- カーソルは keyset pagination。取得行数を `PAGE_SIZE + 1` にして余分な1件の有無で `hasMore` を判定し、次カーソルには最後の行の `created_at` を使う（offsetベースと異なり、一覧閲覧中に新規フォローが発生してもページがズレない）
- 自分自身の行（`otherId === currentUser.id`）は `isFollowingByMe` を計算する必要はなく、UI側でボタンを非表示にする

## UI / コンポーネント

`pages/profile/$userId/connections.tsx` にページローカルなコンポーネントとして実装する（他から再利用されるまでは独立スライスを作らない）。

- `PageHeader`（既存共通コンポーネント）: タイトルは「フォロワー」/「フォロー中」、`backTo` は元のプロフィールページ
- タブ切り替えUI: 2ボタン、`Button` プリミティブ（既存 `FollowButton`/`FamilyButton` と同じ）を使い、アクティブなタブをスタイルで表現。切り替え時は一覧の state（`rows`・`cursor`・`hasMore`）をリセットし、初期ページを再取得する
- `ConnectionRow`（ページ内ローカルコンポーネント）:
  - `UserAvatar` + `resolveUserIdentity`（いずれも既存）で表示名を表示
  - 行全体を `<Link to="/profile/$userId" params={{ userId: row.user.id }}>` でその人のプロフィールへ遷移させる
  - 行の右端に既存 `FollowButton` を配置。**行のユーザーが自分自身の場合はボタンを非表示にする**（自己フォローUIを出さない）
- 一覧末尾に「もっと見る」ボタンを配置し、`nextCursor` が存在する時のみ表示。押下で `fetchConnections` を追加のカーソル付きで呼び出し、結果を既存 `rows` の末尾に追記する
- 0件時は既存の `EmptyState` を使用し、タブに応じて文言を出し分ける（例: 「まだフォロワーがいません」/「まだ誰もフォローしていません」）

### 状態管理

- ページコンポーネントは `useState` で `rows` / `cursor` / `hasMore` / `loadingMore` を保持する
- 初回データは `Route.loader` 経由で取得し `Route.useLoaderData()` から得る。タブ切り替えは `search.tab` の変化を検知して state をリセットし、`fetchConnections` をクライアントから呼び直す
- 「もっと見る」時はクライアントから直接 `fetchConnections` を呼び出し、`rows` に追記する（ページ全体の再取得は行わない）
- `FollowButton` は既存実装のまま、自身の楽観的更新のみ行う（一覧全体の再取得は不要）

## エラーハンドリング

- 初回ロード失敗時: ルート `loader` の reject を既存の TanStack Start エラーバウンダリに委譲する（他ページと同じ扱いとし、専用のエラーUIは作らない）
- 「もっと見る」失敗時: `loadingMore` を false に戻し、ボタンを再度押せる状態にする（トースト等は既存に無いため何もしない）

## テスト（TDD）

`tests/` 配下に新規テストファイルを追加し、以下を失敗テストから実装する。

1. `followers` タブでユーザー一覧が表示される
2. `following` タブに切り替えると表示が切り替わる
3. 自分自身の行には `FollowButton` が表示されない
4. 「もっと見る」ボタン押下で追加行が末尾に表示される（`hasMore` が false になればボタンが非表示になる）
5. 0件時に `EmptyState` が表示される
