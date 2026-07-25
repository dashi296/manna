# フォロー中/フォロワー一覧ページ 設計

- Issue: #66
- PR: #67

## 背景

`/profile/$userId` には「フォロワー」「フォロー中」の件数が表示されているが（`apps/pwa/src/pages/profile/$userId.tsx:108-115`）、クリックしても一覧は開かない。

他人のプロフィールへ辿り着く導線自体が、現状ほぼ通知経由（自分の投稿へのいいね／フォローされた／家族申請を受けた、いずれも `supabase/migrations/20260519000003_triggers.sql` のトリガーで発生）に限定されている。一度誰かのプロフィールに辿り着いても、そこから「その人がフォローしている人」「その人をフォローしている人」を辿って他のユーザーに到達する手段がなく、投稿を介さないフォローの起点が乏しい。

この spec は、フォロー中/フォロワーの一覧を閲覧できるようにすることで、既存のフォローグラフを辿れるようにする改善を扱う。

## スコープ

**含む**: フォロー中/フォロワー一覧ページの追加、および一覧クエリを支えるインデックスの追加。

**含まない（別issueで検討）**:
- 家族一覧ページの新設
- ユーザー検索/ディレクトリ（プライバシー考慮が必要なため別途設計する）

## ルーティング

### 既存ルートのリネーム（必須）

`pages/profile/$userId.tsx` を残したまま `pages/profile/$userId/connections.tsx` を追加すると、ルートジェネレータは connections を `$userId` の**子ルート**として生成する（`getParentRoute: () => ProfileUserIdRoute`）。`ProfilePage` には `<Outlet />` が無いため、`/profile/$userId/connections` を開いてもプロフィールページが描画されるだけで一覧は表示されない。

これを避けるため、**`pages/profile/$userId.tsx` を `pages/profile/$userId/index.tsx` にリネームする**。この構成ではジェネレータは両ルートをフラット（`getParentRoute: () => rootRouteImport`）に生成する。`profile/index.tsx` という既存の書き方とも揃う。

`FileRoutesByTo` 上は `'/profile/$userId': typeof ProfileUserIdIndexRoute` が維持されるため、既存の `notifications.tsx:71,77` の `to="/profile/$userId"` リンクは変更不要。

### 新規ルート

- `pages/profile/$userId/connections.tsx` → `/profile/$userId/connections`
- タブは `?tab=followers|following` の search param で管理（`validateSearch` で `'followers' | 'following'` に型を絞る）。デフォルトは `followers`
- **`loaderDeps` の宣言が必須**。TanStack Router では search param は `loaderDeps` を経由しないと loader に渡らない（既存例: `$chapter.tsx:216`）。

```ts
validateSearch: (search: Record<string, unknown>): ConnectionsSearch => ({
  tab: search.tab === 'following' ? 'following' : 'followers',
}),
loaderDeps: ({ search }) => ({ tab: search.tab }),
loader: async ({ params, deps }) =>
  fetchConnections({ data: { userId: params.userId, tab: deps.tab, cursor: null } }),
```

`loaderDeps` に `tab` を含めることで、**タブ切り替え時は loader が自動で再実行される**。クライアント側で再取得を書くと二重取得になるため書かない。

- `profile/$userId/index.tsx` の「フォロワー」「フォロー中」の `<span>` 表示を `<Link to="/profile/$userId/connections" params={{ userId: profile.id }} search={{ tab: 'followers' }}>` / `search={{ tab: 'following' }}` に変更する
- 認証ガードは既存の `AUTH_REQUIRED_PREFIXES`（`/profile` prefix）でカバーされるため追加対応は不要。ログインしていれば誰でも閲覧可能とする（`follows` テーブルは RLS 上 `follows_select_all` により既に全ユーザーに公開されており、フォロワー/フォロー中件数も現状誰でも見られるため、一覧を見せることによる新たなプライバシー上の後退はない）

## DB マイグレーション

`follows` の PK は `(follower_id, following_id)` のみで、`following_id` 単体のインデックスが存在しない。フォロワータブの `.eq('following_id', userId)` は PK の前方一致が効かず、また両タブとも `created_at` 降順で並べるため PK は ORDER BY にも使えない。`supabase/CLAUDE.md` の「RLS/フィルタで参照する列に必ずインデックスを貼る」方針に従い、両タブ用の複合インデックスを追加する。

```sql
-- フォロワータブ: WHERE following_id = ? ORDER BY created_at DESC, follower_id DESC
CREATE INDEX IF NOT EXISTS follows_following_created_idx
  ON public.follows (following_id, created_at DESC, follower_id DESC);

-- フォロー中タブ: WHERE follower_id = ? ORDER BY created_at DESC, following_id DESC
CREATE INDEX IF NOT EXISTS follows_follower_created_idx
  ON public.follows (follower_id, created_at DESC, following_id DESC);
```

ファイル名は `YYYYMMDDHHmmss_add_follows_pagination_indexes.sql` の形式とする。

## サーバー関数 `fetchConnections`

`profile/$userId/index.tsx` の `fetchProfileData` と同じ `createServerFn` パターンで新設する。

`follows` テーブルは `follower_id` / `following_id` の2本の外部キーで `users` を参照しているため（`supabase/migrations/20260519000001_initial_schema.sql:34-40`）、PostgREST の埋め込みで曖昧にならないよう、`follows` 行の取得と相手ユーザー情報の取得を分離して素朴に組み立てる。

### カーソルの形

`created_at` 単体をカーソルにすると、同値の行があった場合に `.lt('created_at', cursor)` が同値行をまとめて飛ばす。`created_at` の DEFAULT は `now()`（トランザクション時刻）なので、seed 等の一括 INSERT で同値になり得る。これを避けるため **`(created_at, 相手のユーザーID)` の複合カーソル**にする。`ownIdColumn` を固定値で絞り込んでいるため、`otherIdColumn` は同一 `created_at` 内で一意になり、タイブレーカーとして機能する。

### カーソルの実行時検証（必須）

カーソルは「もっと見る」時にクライアントから送られてくる値で、そのまま `.or()` の文字列に補間される。`inputValidator` は型注釈だけでは実行時に何も検証しないため、`otherId` に `"` や `,` を仕込まれると `or=(...)` 式を書き換えられる（フィルタインジェクション）。RLS は効き続け、`follows` は `follows_select_all` で元々全公開のため新たに読めるデータは増えないが、`inputValidator` で形式を検証して塞ぐ。

既存の `familyPairFilter` も id を補間しているが、あちらの値は `auth.getUser()` と route param 由来であり、自由入力であるカーソルとは性質が異なる。

検証には**厳密な ISO 8601 の正規表現**を使う。`Date.parse` は `Jan 1, 2026` のような非 ISO 形式も受け付けてしまい、カンマを含んだまま通過するため用をなさない。また `toISOString()` で正規化する方法も使えない — JS の `Date` はミリ秒精度しか持たず、Postgres の timestamptz がマイクロ秒を持つ場合に精度が落ちて keyset 条件が一致しなくなる。

```ts
type Cursor = { createdAt: string; otherId: string }

const PAGE_SIZE = 20
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// PostgREST が返す timestamptz。小数秒は桁数可変、末尾は 'Z' か '+09:00' 形式のオフセット。
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

const fetchConnections = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    userId: string
    tab: 'followers' | 'following'
    cursor: Cursor | null
  }) => {
    if (data.cursor) {
      const { createdAt, otherId } = data.cursor
      if (!UUID_RE.test(otherId)) throw new Error('invalid cursor')
      if (!ISO_TS_RE.test(createdAt)) throw new Error('invalid cursor')
    }
    return data
  })
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
      .order(otherIdColumn, { ascending: false })
      .limit(PAGE_SIZE + 1)

    // (created_at, otherId) < (cursor.createdAt, cursor.otherId) の keyset 条件。
    // PostgREST は `列.演算子.値` を '.' で、条件どうしを ',' で区切るため、
    // マイクロ秒付き timestamptz（'.' を含む）はダブルクォートで囲む必要がある。
    if (cursor) {
      query = query.or(
        `created_at.lt."${cursor.createdAt}",` +
        `and(created_at.eq."${cursor.createdAt}",${otherIdColumn}.lt."${cursor.otherId}")`,
      )
    }

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
    const last = page[page.length - 1]

    return {
      rows: page.flatMap((r) => {
        const user = usersById.get(r[otherIdColumn] as string)
        return user ? [{ user, isFollowingByMe: followingSet.has(user.id) }] : []
      }),
      tab,
      currentUserId: currentUser?.id ?? null,
      nextCursor: hasMore && last
        ? { createdAt: last.created_at, otherId: last[otherIdColumn] as string }
        : null,
    }
  })
```

- `PAGE_SIZE = 20`（投稿一覧 `limit(20)` に合わせる）
- 取得行数を `PAGE_SIZE + 1` にして余分な1件の有無で `hasMore` を判定し、次カーソルには `PAGE_SIZE` 件目の `(created_at, otherId)` を使う。offset ベースと異なり、一覧閲覧中に新規フォローが発生してもページがズレない
- 自分自身の行は `isFollowingByMe` を使わず、UI側でボタンを非表示にする（`follows` は `CHECK (follower_id != following_id)` により自己フォロー自体が存在しない）
- 戻り値に `tab` を含める。コンポーネントは **`Route.useSearch()` ではなく `loaderData.tab`** からアクティブタブを読む。既存のテストヘルパー `tests/helpers/tanstack.tsx` の `routerMock` は `createFileRoute` が `{...config, useLoaderData}` を返すだけで `useSearch` / `useNavigate` を提供していないため、`loaderData` 経由にすることで `useSearch` の追加は不要になる（`TabBar` のために `useNavigate` は別途追加する。「テスト」セクションを参照）

## UI / コンポーネント

`pages/profile/$userId/connections.tsx` にページローカルなコンポーネントとして実装する（他から再利用されるまでは独立スライスを作らない）。

- `PageHeader`（既存共通コンポーネント）: タイトルは「フォロワー」/「フォロー中」、`backTo="/profile/$userId"`。`PageHeader` は `params` を渡さず現在の params を引き継ぐ実装なので、ルートパターンをそのまま文字列で渡す（既存の `backTo="/scriptures/$collection"` と同じ使い方）
- タブ切り替えUI: 既存の共有コンポーネント `TabBar`（フィードページで使用中）を再利用し、`active={loaderData.tab}` を渡す。`onChange` では `navigate({ search: { tab } })` で search param を変えるだけとし、データ再取得は `loaderDeps` 経由の loader 再実行に任せる。`TabBar` はコールバック方式のため `useNavigate` が必要になり、`routerMock` に `useNavigate` の追加が要る
- `ConnectionRow`（ページ内ローカルコンポーネント）:
  - `UserAvatar` + `resolveUserIdentity`（いずれも既存）で表示名を表示
  - 行全体を `<Link to="/profile/$userId" params={{ userId: row.user.id }}>` でその人のプロフィールへ遷移させる
  - 行の右端に既存 `FollowButton` を配置し、`targetUserId={row.user.id}` / `currentUserId={currentUserId}` / `initialFollowing={row.isFollowingByMe}` を渡す。描画するのは **`currentUserId` が非 null かつ `row.user.id !== currentUserId`** のときのみ（自己フォローUIを出さない）
- 一覧末尾に「もっと見る」ボタンを配置し、`nextCursor` が存在する時のみ表示。押下で `fetchConnections` を次カーソル付きで呼び出し、結果を既存 `rows` の末尾に追記する
- 0件時は既存の `EmptyState`（`children` のみを取る）を使用し、タブに応じて文言を出し分ける（例: 「まだフォロワーがいません」/「まだ誰もフォローしていません」）

### 状態管理

- 初回データは loader から `Route.useLoaderData()` で受け取る
- 「もっと見る」で追記した分だけを `useState` で保持し（`extraRows` / `cursor` / `loadingMore`）、表示は `loaderData.rows` + `extraRows` を連結する
- `cursor` の初期値は `loaderData.nextCursor`。`loaderData` が変化したとき（タブ切り替え時）は `extraRows` を空配列に、`cursor` を **新しい `loaderData.nextCursor` に** 戻す（`null` に戻すと「もっと見る」が消えてしまう）
- `FollowButton` は既存実装のまま、自身の楽観的更新のみ行う（一覧全体の再取得は不要）

## エラーハンドリング

- 初回ロード失敗時: ルート `loader` の reject を既存の TanStack Start エラーバウンダリに委譲する（他ページと同じ扱いとし、専用のエラーUIは作らない）
- 「もっと見る」失敗時: `loadingMore` を false に戻し、ボタンを再度押せる状態にする（トースト等は既存に無いため何もしない）

## テスト（TDD）

`apps/pwa/tests/pages/connections.test.tsx` を新規追加し（既存の `tests/pages/feed.test.tsx` と同じ配置）、以下を失敗テストから実装する。

アクティブタブは `loaderData.tab` から読むため、タブ切り替えの検証は `useLoaderData` のモック値を差し替えて行う。ただし `TabBar` の `onChange` で `useNavigate` を使うため、`routerMock` に `useNavigate: () => navigate` の追加が必要。

一方で **`startMock()` の拡張が必要**になる。現在の実装は `.handler()` が呼ばれるたびに新しい `vi.fn()` を返すため、テスト側からその実体を掴めず、「もっと見る」で呼ばれる `fetchConnections` の戻り値を制御できない。既存テストでサーバー関数の戻り値を制御しているものは無く（`mockResolvedValue` を使っているのは `FollowButton.test.tsx` などの supabase クライアント側のモックのみ）、既存のページテストはサーバー関数が `loader` の中でしか呼ばれないため素通りしている。コンポーネントの操作でサーバー関数を呼ぶのは今回が初めてになる。

`startMock()` に任意引数を足し、渡された場合はその mock を返すようにする（引数なしの既存呼び出しはそのまま動く）。

```ts
export function startMock(impl?: ReturnType<typeof vi.fn>) {
  const handler = () => impl ?? vi.fn()
  return {
    createServerFn: () => ({
      handler,
      inputValidator: () => ({ handler }),
    }),
  }
}
```

テスト側では `vi.fn().mockResolvedValue({ rows, tab, currentUserId, nextCursor })` を渡し、「もっと見る」押下後の追記を検証する。

1. `followers` タブでユーザー一覧が表示される
2. `tab: 'following'` の loader データではフォロー中の一覧が表示される
3. 自分自身の行には `FollowButton` が表示されない
4. 「もっと見る」ボタン押下で追加行が末尾に表示される（`nextCursor` が null になればボタンが非表示になる）
5. 0件時に `EmptyState` が表示される

リネームによる既存ルートの回帰確認として、`/profile/$userId` が従来どおり描画されることも確認する。
