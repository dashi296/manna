# フォロー中/フォロワー一覧ページ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プロフィールページの「フォロワー」「フォロー中」の件数から一覧ページへ遷移し、一覧の各行から直接フォロー/フォロー解除できるようにする。

**Architecture:** `/profile/$userId/connections` を新設し、タブ（`?tab=followers|following`）を search param で管理する。データは `createServerFn` の `fetchConnections` が `follows` テーブルから keyset pagination で取得し、`loaderDeps` 経由で loader に渡す。既存の `TabBar` / `FollowButton` / `UserAvatar` / `EmptyState` / `PageHeader` を再利用する。

**Tech Stack:** TanStack Start (file-based routing), Supabase (PostgREST), React 19, Vitest + @testing-library/react

**Spec:** [`docs/superpowers/specs/2026-07-25-follow-connections-list-design.md`](../specs/2026-07-25-follow-connections-list-design.md) / Issue #66 / PR #67

## Global Constraints

- `PAGE_SIZE = 20`（投稿一覧の `limit(20)` に合わせる）
- FSD のインポート方向を守る（pages → widgets / features / entities / shared）。スライス内部への直接 import は禁止し、必ず `index.ts` 経由で読む
- コメントは原則不要。WHY が自明でない場合のみ1行で記載する
- UI は TDD（失敗するテスト → 実装 → 通過）で実装する
- コンポーネントのテストは `apps/pwa/tests/` 下に置く
- マイグレーションのファイル名は `YYYYMMDDHHmmss_説明.sql`。`CREATE INDEX IF NOT EXISTS` で冪等に書く
- カーソルはクライアント入力であり `.or()` に文字列補間されるため、必ず実行時検証を通す
- テストコマンドは `apps/pwa` ディレクトリで `pnpm test <パス>`。全件は リポジトリルートで `pnpm test`
- ベースライン: 45ファイル / 241テストがパスしている状態から始める

## File Structure

| ファイル | 役割 |
|---|---|
| `supabase/migrations/<ts>_add_follows_pagination_indexes.sql` | 新規。両タブのクエリを支える複合インデックス |
| `apps/pwa/src/pages/profile/$userId/cursor.ts` | 新規。カーソル型とインジェクション対策の検証。ルート生成の対象外（検証済み） |
| `apps/pwa/src/pages/profile/$userId/index.tsx` | `$userId.tsx` からのリネーム。末尾でフォロワー数/フォロー中数をリンク化 |
| `apps/pwa/src/pages/profile/$userId/connections.tsx` | 新規。`fetchConnections` と一覧ページ本体 |
| `apps/pwa/tests/helpers/tanstack.tsx` | 既存。`useNavigate` と `startMock` の実装差し込みを追加 |
| `apps/pwa/tests/pages/profile/index.test.tsx` | 新規。リネームの回帰テストとリンク導線のテスト |
| `apps/pwa/tests/pages/profile/cursor.test.ts` | 新規。カーソル検証のユニットテスト |
| `apps/pwa/tests/pages/profile/connections.test.tsx` | 新規。一覧ページのテスト |

**なぜ `$userId.tsx` をリネームするのか:** `$userId.tsx` を残したまま `$userId/connections.tsx` を追加すると、ルートジェネレータは connections を `$userId` の子ルートとして生成する。`ProfilePage` に `<Outlet />` が無いため、`/profile/$userId/connections` を開いてもプロフィールページが描画されて一覧が表示されない。`$userId/index.tsx` にすると両ルートがフラットに生成される。

---

### Task 1: フォロー一覧クエリ用のインデックス追加

**Files:**
- Create: `supabase/migrations/<YYYYMMDDHHmmss>_add_follows_pagination_indexes.sql`

**Interfaces:**
- Consumes: なし
- Produces: `follows_following_created_idx` / `follows_follower_created_idx`（Task 4 のクエリが使う）

`follows` の PK は `(follower_id, following_id)` のみ。フォロワータブの `.eq('following_id', ...)` は PK の前方一致が効かず、両タブとも `created_at` 降順で並べるため PK は ORDER BY にも使えない。

- [ ] **Step 1: ローカル Supabase が起動していることを確認**

Run: `npx supabase status`
Expected: `API URL` などが表示される。起動していなければ `npx supabase start`

- [ ] **Step 2: 現状インデックスが無いことを確認**

Run:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "select indexname from pg_indexes where tablename = 'follows';"
```
Expected: `follows_pkey` のみが出力される

- [ ] **Step 3: マイグレーションファイルを作成**

ファイル名のタイムスタンプは `date +%Y%m%d%H%M%S` で生成する。

```sql
-- フォロワータブ: WHERE following_id = ? ORDER BY created_at DESC, follower_id DESC
CREATE INDEX IF NOT EXISTS follows_following_created_idx
  ON public.follows (following_id, created_at DESC, follower_id DESC);

-- フォロー中タブ: WHERE follower_id = ? ORDER BY created_at DESC, following_id DESC
CREATE INDEX IF NOT EXISTS follows_follower_created_idx
  ON public.follows (follower_id, created_at DESC, following_id DESC);
```

- [ ] **Step 4: マイグレーションを適用**

Run: `npx supabase migration up --local`
Expected: 上記マイグレーションが適用される

- [ ] **Step 5: インデックスが作られたことを確認**

Run:
```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "select indexname from pg_indexes where tablename = 'follows';"
```
Expected: `follows_pkey` に加えて `follows_following_created_idx` と `follows_follower_created_idx` が出力される

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: index follows for the paginated connections queries"
```

---

### Task 2: カーソルの型と検証ユーティリティ

**Files:**
- Create: `apps/pwa/src/pages/profile/$userId/cursor.ts`
- Test: `apps/pwa/tests/pages/profile/cursor.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `export type Cursor = { createdAt: string; otherId: string }` / `export function isValidCursor(cursor: Cursor): boolean`（Task 4 が使う）

カーソルは「もっと見る」でクライアントから送られ、そのまま PostgREST の `.or()` 文字列に補間される。`Date.parse` は `Jan 1, 2026` のような非 ISO 形式を通してしまい、カンマがフィルタ式に混入する。`toISOString()` での正規化も使えない（JS の `Date` はミリ秒精度しかなく、timestamptz のマイクロ秒が落ちて keyset 条件が一致しなくなる）。そのため厳密な正規表現で弾く。

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/pages/profile/cursor.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isValidCursor } from '@/pages/profile/$userId/cursor'

const VALID_UUID = '11111111-2222-3333-4444-555555555555'

describe('isValidCursor', () => {
  it('PostgREST が返す timestamptz を受け付ける', () => {
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00+00:00', otherId: VALID_UUID })).toBe(true)
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00.123456+00:00', otherId: VALID_UUID })).toBe(true)
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00Z', otherId: VALID_UUID })).toBe(true)
  })

  it('Date.parse は通すが ISO ではない形式を弾く', () => {
    expect(isValidCursor({ createdAt: 'Jan 1, 2026', otherId: VALID_UUID })).toBe(false)
  })

  it('フィルタ式を壊す文字を含む値を弾く', () => {
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00+00:00"', otherId: VALID_UUID })).toBe(false)
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00+00:00,or(1.eq.1)', otherId: VALID_UUID })).toBe(false)
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00+00:00', otherId: `${VALID_UUID}"` })).toBe(false)
  })

  it('UUID でない otherId を弾く', () => {
    expect(isValidCursor({ createdAt: '2026-07-25T10:00:00+00:00', otherId: 'not-a-uuid' })).toBe(false)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd apps/pwa && pnpm test tests/pages/profile/cursor.test.ts`
Expected: FAIL（`Failed to resolve import "@/pages/profile/$userId/cursor"`）

- [ ] **Step 3: 実装する**

`apps/pwa/src/pages/profile/$userId/cursor.ts`:

```ts
export type Cursor = { createdAt: string; otherId: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// PostgREST が返す timestamptz。小数秒は桁数可変、末尾は 'Z' かオフセット。
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

// カーソルは .or() の文字列に補間されるためフィルタインジェクションを防ぐ
export function isValidCursor(cursor: Cursor): boolean {
  return UUID_RE.test(cursor.otherId) && ISO_TS_RE.test(cursor.createdAt)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd apps/pwa && pnpm test tests/pages/profile/cursor.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/pages/profile apps/pwa/tests/pages/profile
git commit -m "feat: validate pagination cursors before interpolating them"
```

---

### Task 3: プロフィールルートを `$userId/index.tsx` にリネーム

**Files:**
- Rename: `apps/pwa/src/pages/profile/$userId.tsx` → `apps/pwa/src/pages/profile/$userId/index.tsx`
- Modify: `apps/pwa/src/routeTree.gen.ts`（ビルドで自動再生成）
- Test: `apps/pwa/tests/pages/profile/index.test.tsx`

**Interfaces:**
- Consumes: なし
- Produces: `/profile/$userId` ルート（Task 6 が同じファイルを編集する）

`to="/profile/$userId"` の型は `FileRoutesByTo` 上で維持されるため、`notifications.tsx:71,77` の既存リンクは変更不要。

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/pages/profile/index.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { routeComponent } from '../../helpers/tanstack'

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(() => ({
    profile: { id: 'u2', display_name: 'テスト太郎', avatar_url: null, bio: null },
    posts: [],
    currentUserId: null,
    isFollowing: false,
    familyStatus: 'none',
    followerCount: 3,
    followingCount: 5,
  })),
)

vi.mock('@tanstack/react-start', async () => (await import('../../helpers/tanstack')).startMock())

describe('ProfilePage', () => {
  it('表示名とフォロワー数/フォロー中数を表示する', async () => {
    const ProfilePage = routeComponent(await import('@/pages/profile/$userId/index'))
    render(<ProfilePage />)
    expect(screen.getByText('テスト太郎')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd apps/pwa && pnpm test tests/pages/profile/index.test.tsx`
Expected: FAIL（`Failed to resolve import "@/pages/profile/$userId/index"`）

- [ ] **Step 3: ファイルをリネームする**

```bash
mkdir -p 'apps/pwa/src/pages/profile/$userId'
git mv 'apps/pwa/src/pages/profile/$userId.tsx' 'apps/pwa/src/pages/profile/$userId/index.tsx'
```

ファイル内の `createFileRoute('/profile/$userId')` は変更しない（ルートパスは同じ）。

- [ ] **Step 4: ルートツリーを再生成する**

Run: `cd apps/pwa && pnpm build`
Expected: ビルド成功。`git diff apps/pwa/src/routeTree.gen.ts` に `ProfileUserIdIndexRouteImport` への差し替えが出る

- [ ] **Step 5: テストが通ることを確認**

Run: `cd apps/pwa && pnpm test tests/pages/profile/index.test.tsx`
Expected: PASS（1 test）

- [ ] **Step 6: 全件テストで回帰がないことを確認**

Run: リポジトリルートで `pnpm test`
Expected: 全ファイルパス（242 tests 以上）

- [ ] **Step 7: Commit**

```bash
git add apps/pwa/src/pages/profile apps/pwa/src/routeTree.gen.ts apps/pwa/tests/pages/profile
git commit -m "refactor: move the profile route into an index file"
```

---

### Task 4: `fetchConnections` と一覧ページ

**Files:**
- Create: `apps/pwa/src/pages/profile/$userId/connections.tsx`
- Modify: `apps/pwa/tests/helpers/tanstack.tsx`（`useNavigate` を追加）
- Modify: `apps/pwa/src/routeTree.gen.ts`（ビルドで自動再生成）
- Test: `apps/pwa/tests/pages/profile/connections.test.tsx`

**Interfaces:**
- Consumes: `isValidCursor` / `Cursor`（Task 2）、`follows` のインデックス（Task 1）
- Produces:
  - `fetchConnections({ data: { userId: string; tab: 'followers' | 'following'; cursor: Cursor | null } })` →
    `Promise<{ userId: string; tab: Tab; currentUserId: string | null; rows: ConnectionRowData[]; nextCursor: Cursor | null }>`
  - `type ConnectionRowData = { user: { id: string; display_name: string | null; avatar_url: string | null }; isFollowingByMe: boolean }`
  - Task 5 が同じファイルに「もっと見る」を足す

タブ切り替えは `TabBar`（既存共有コンポーネント）の `onChange` から `navigate` で search param を変えるだけにし、データ再取得は `loaderDeps` 経由の loader 再実行に任せる。`routerMock` は `useNavigate` を提供していないため追加する。

- [ ] **Step 1: テストヘルパーに `useNavigate` を追加**

`apps/pwa/tests/helpers/tanstack.tsx` の `routerMock` にシグネチャと戻り値を追加する（既存の引数なし呼び出しはそのまま動く）。

```tsx
export function routerMock(
  useLoaderData: () => unknown = () => ({}),
  getPathname: () => string = () => '/',
  navigate: (opts: unknown) => void = () => {},
) {
```

戻り値のオブジェクトに1行足す:

```tsx
    useNavigate: () => navigate,
```

- [ ] **Step 2: 失敗するテストを書く**

`apps/pwa/tests/pages/profile/connections.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { routeComponent } from '../../helpers/tanstack'

const loaderData = vi.fn()

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(() => loaderData()),
)

vi.mock('@tanstack/react-start', async () => (await import('../../helpers/tanstack')).startMock())

vi.mock('@/shared/lib/supabase', () => ({
  supabase: { from: () => ({ insert: vi.fn(), delete: vi.fn() }) },
}))

const row = (id: string, name: string, isFollowingByMe = false) => ({
  user: { id, display_name: name, avatar_url: null },
  isFollowingByMe,
})

const base = {
  userId: 'owner',
  tab: 'followers' as const,
  currentUserId: 'me',
  rows: [] as ReturnType<typeof row>[],
  nextCursor: null,
}

const renderPage = async () => {
  const ConnectionsPage = routeComponent(await import('@/pages/profile/$userId/connections'))
  render(<ConnectionsPage />)
}

describe('ConnectionsPage', () => {
  it('フォロワータブでユーザー一覧を表示する', async () => {
    loaderData.mockReturnValue({ ...base, rows: [row('u1', '山田花子'), row('u2', '佐藤太郎')] })
    await renderPage()
    expect(screen.getByText('山田花子')).toBeInTheDocument()
    expect(screen.getByText('佐藤太郎')).toBeInTheDocument()
  })

  it('フォロー中タブのデータではフォロー中の一覧を表示する', async () => {
    loaderData.mockReturnValue({ ...base, tab: 'following', rows: [row('u3', '鈴木次郎')] })
    await renderPage()
    expect(screen.getByText('鈴木次郎')).toBeInTheDocument()
  })

  it('自分自身の行にはフォローボタンを表示しない', async () => {
    loaderData.mockReturnValue({ ...base, rows: [row('me', '自分'), row('u1', '山田花子')] })
    await renderPage()
    expect(screen.getAllByRole('button', { name: 'フォロー' })).toHaveLength(1)
  })

  it('0件のときは空状態を表示する', async () => {
    loaderData.mockReturnValue({ ...base, rows: [] })
    await renderPage()
    expect(screen.getByText('まだフォロワーがいません')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `cd apps/pwa && pnpm test tests/pages/profile/connections.test.tsx`
Expected: FAIL（`Failed to resolve import "@/pages/profile/$userId/connections"`）

- [ ] **Step 4: ページを実装する**

`apps/pwa/src/pages/profile/$userId/connections.tsx`:

```tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { FollowButton } from '@/features/follow-user'
import { EmptyState, PageHeader, TabBar, UserAvatar } from '@/shared/ui'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { createSupabaseServer } from '@/shared/lib/auth'
import { isValidCursor, type Cursor } from './cursor'

type Tab = 'followers' | 'following'
type ConnectionUser = { id: string; display_name: string | null; avatar_url: string | null }
export type ConnectionRowData = { user: ConnectionUser; isFollowingByMe: boolean }

const PAGE_SIZE = 20

const TABS: { id: Tab; label: string }[] = [
  { id: 'followers', label: 'フォロワー' },
  { id: 'following', label: 'フォロー中' },
]

export const fetchConnections = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; tab: Tab; cursor: Cursor | null }) => {
    if (data.cursor && !isValidCursor(data.cursor)) throw new Error('invalid cursor')
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

    // (created_at, otherId) < カーソル の keyset 条件。PostgREST は '.' と ',' を
    // 区切りに使うため、小数秒を含む timestamptz はダブルクォートで囲む。
    if (cursor) {
      query = query.or(
        `created_at.lt."${cursor.createdAt}",` +
          `and(created_at.eq."${cursor.createdAt}",${otherIdColumn}.lt."${cursor.otherId}")`,
      )
    }

    const { data: followRows } = await query
    const hasMore = (followRows ?? []).length > PAGE_SIZE
    const page = ((followRows ?? []) as Record<string, string>[]).slice(0, PAGE_SIZE)
    const otherIds = page.map((r) => r[otherIdColumn])

    const {
      data: { user: currentUser },
    } = await serverSupabase.auth.getUser()

    const [usersRes, myFollowsRes] = await Promise.all([
      otherIds.length
        ? serverSupabase.from('users').select('id, display_name, avatar_url').in('id', otherIds)
        : null,
      currentUser && otherIds.length
        ? serverSupabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUser.id)
            .in('following_id', otherIds)
        : null,
    ])

    const usersById = new Map((usersRes?.data ?? []).map((u) => [u.id, u]))
    const followingSet = new Set((myFollowsRes?.data ?? []).map((f) => f.following_id))
    const last = page[page.length - 1]

    return {
      userId,
      tab,
      currentUserId: currentUser?.id ?? null,
      rows: page.flatMap((r) => {
        const user = usersById.get(r[otherIdColumn])
        return user ? [{ user, isFollowingByMe: followingSet.has(user.id) }] : []
      }),
      nextCursor:
        hasMore && last
          ? { createdAt: last.created_at, otherId: last[otherIdColumn] }
          : null,
    }
  })

export const Route = createFileRoute('/profile/$userId/connections')({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search.tab === 'following' ? 'following' : 'followers',
  }),
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  loader: ({ params, deps }) =>
    fetchConnections({ data: { userId: params.userId, tab: deps.tab, cursor: null } }),
  component: ConnectionsPage,
})

function ConnectionRow({
  row,
  currentUserId,
}: {
  row: ConnectionRowData
  currentUserId: string | null
}) {
  const { displayName, avatarUrl } = resolveUserIdentity(row.user)
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b"
      style={{ borderColor: 'var(--line)' }}
    >
      <Link
        to="/profile/$userId"
        params={{ userId: row.user.id }}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <UserAvatar name={displayName} url={avatarUrl} size="sm" />
        <span
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--sea-ink)' }}
        >
          {displayName}
        </span>
      </Link>
      {currentUserId && currentUserId !== row.user.id && (
        <FollowButton
          targetUserId={row.user.id}
          currentUserId={currentUserId}
          initialFollowing={row.isFollowingByMe}
        />
      )}
    </div>
  )
}

function ConnectionsPage() {
  const { userId, tab, rows, currentUserId } = Route.useLoaderData()
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        title={tab === 'followers' ? 'フォロワー' : 'フォロー中'}
        backTo="/profile/$userId"
        backLabel="プロフィール"
      />
      <TabBar
        tabs={TABS}
        active={tab}
        onChange={(id) =>
          navigate({
            to: '/profile/$userId/connections',
            params: { userId },
            search: { tab: id },
          })
        }
      />
      {rows.length === 0 ? (
        <EmptyState>
          {tab === 'followers' ? 'まだフォロワーがいません' : 'まだ誰もフォローしていません'}
        </EmptyState>
      ) : (
        <div>
          {rows.map((row) => (
            <ConnectionRow key={row.user.id} row={row} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `cd apps/pwa && pnpm test tests/pages/profile/connections.test.tsx`
Expected: PASS（4 tests）

- [ ] **Step 6: ルートツリーを再生成して全件テスト**

Run: `cd apps/pwa && pnpm build` の後、リポジトリルートで `pnpm test`
Expected: ビルド成功（`ProfileUserIdConnectionsRoute` が `getParentRoute: () => rootRouteImport` で生成される）、全テストパス

- [ ] **Step 7: Commit**

```bash
git add apps/pwa/src/pages/profile apps/pwa/src/routeTree.gen.ts apps/pwa/tests
git commit -m "feat: add the followers/following connections page"
```

---

### Task 5: 「もっと見る」ページネーション

**Files:**
- Modify: `apps/pwa/src/pages/profile/$userId/connections.tsx`
- Modify: `apps/pwa/tests/helpers/tanstack.tsx`（`startMock` に実装を差し込めるようにする）
- Test: `apps/pwa/tests/pages/profile/connections.test.tsx`

**Interfaces:**
- Consumes: Task 4 の `fetchConnections` と `nextCursor`
- Produces: なし（最終形の一覧ページ）

現在の `startMock()` は `.handler()` が呼ばれるたびに新しい `vi.fn()` を返すため、テストから `fetchConnections` の戻り値を制御できない。既存テストでサーバー関数の戻り値を制御しているものは無く（`mockResolvedValue` を使っているのは supabase クライアント側のモックのみ）、既存ページテストはサーバー関数が `loader` 内でしか呼ばれないため素通りしている。

- [ ] **Step 1: `startMock` に任意の実装を渡せるようにする**

`apps/pwa/tests/helpers/tanstack.tsx` の `startMock` を差し替える（引数なしの既存呼び出しは従来どおり動く）。

```tsx
export function startMock(impl?: (...args: never[]) => unknown) {
  const handler = () => impl ?? vi.fn()
  return {
    createServerFn: () => ({
      handler,
      inputValidator: () => ({ handler }),
    }),
  }
}
```

- [ ] **Step 2: 失敗するテストを書く**

`apps/pwa/tests/pages/profile/connections.test.tsx` の先頭のモック定義を差し替える。

```tsx
const mockFetchConnections = vi.fn()

vi.mock('@tanstack/react-start', async () =>
  (await import('../../helpers/tanstack')).startMock(mockFetchConnections),
)
```

`import userEvent from '@testing-library/user-event'` を追加し、`describe` の末尾に2件足す。

```tsx
  it('nextCursor があるときだけ「もっと見る」を表示する', async () => {
    loaderData.mockReturnValue({ ...base, rows: [row('u1', '山田花子')], nextCursor: null })
    await renderPage()
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument()
  })

  it('「もっと見る」で次のページを末尾に追記する', async () => {
    loaderData.mockReturnValue({
      ...base,
      rows: [row('u1', '山田花子')],
      nextCursor: { createdAt: '2026-07-25T10:00:00+00:00', otherId: 'u1' },
    })
    mockFetchConnections.mockResolvedValue({
      ...base,
      rows: [row('u2', '佐藤太郎')],
      nextCursor: null,
    })
    await renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'もっと見る' }))

    expect(await screen.findByText('佐藤太郎')).toBeInTheDocument()
    expect(screen.getByText('山田花子')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument()
  })
```

`beforeEach` で `mockFetchConnections.mockReset()` を呼ぶ（`vitest` から `beforeEach` を import する）。

- [ ] **Step 3: テストが失敗することを確認**

Run: `cd apps/pwa && pnpm test tests/pages/profile/connections.test.tsx`
Expected: FAIL（「もっと見る」ボタンが存在しない）

- [ ] **Step 4: ページに追加読み込みを実装する**

`connections.tsx` の import に `useEffect` / `useState` と `Button` を足す。

```tsx
import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
```

`ConnectionsPage` を差し替える。

```tsx
function ConnectionsPage() {
  const { userId, tab, rows, currentUserId, nextCursor } = Route.useLoaderData()
  const navigate = useNavigate()
  const [extraRows, setExtraRows] = useState<ConnectionRowData[]>([])
  const [cursor, setCursor] = useState<Cursor | null>(nextCursor)
  const [loadingMore, setLoadingMore] = useState(false)

  // タブ切り替えで loader が再実行されたら、前のタブの追加読み込み分を捨てる
  useEffect(() => {
    setExtraRows([])
    setCursor(nextCursor)
  }, [tab, nextCursor])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await fetchConnections({ data: { userId, tab, cursor } })
      setExtraRows((prev) => [...prev, ...next.rows])
      setCursor(next.nextCursor)
    } catch {
      // 失敗時は追記せず、ボタンを押せる状態に戻すだけにする
    } finally {
      setLoadingMore(false)
    }
  }

  const allRows = [...rows, ...extraRows]

  return (
    <div>
      <PageHeader
        title={tab === 'followers' ? 'フォロワー' : 'フォロー中'}
        backTo="/profile/$userId"
        backLabel="プロフィール"
      />
      <TabBar
        tabs={TABS}
        active={tab}
        onChange={(id) =>
          navigate({
            to: '/profile/$userId/connections',
            params: { userId },
            search: { tab: id },
          })
        }
      />
      {allRows.length === 0 ? (
        <EmptyState>
          {tab === 'followers' ? 'まだフォロワーがいません' : 'まだ誰もフォローしていません'}
        </EmptyState>
      ) : (
        <div>
          {allRows.map((row) => (
            <ConnectionRow key={row.user.id} row={row} currentUserId={currentUserId} />
          ))}
          {cursor && (
            <div className="p-4 text-center">
              <Button onClick={loadMore} disabled={loadingMore} variant="outline" size="sm">
                もっと見る
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `cd apps/pwa && pnpm test tests/pages/profile/connections.test.tsx`
Expected: PASS（6 tests）

- [ ] **Step 6: 全件テストで回帰がないことを確認**

Run: リポジトリルートで `pnpm test`
Expected: 全テストパス（`startMock` を使う既存4ファイルが壊れていないこと）

- [ ] **Step 7: Commit**

```bash
git add apps/pwa/src/pages/profile apps/pwa/tests
git commit -m "feat: page through connections with a load-more button"
```

---

### Task 6: プロフィールページから一覧への導線

**Files:**
- Modify: `apps/pwa/src/pages/profile/$userId/index.tsx`
- Test: `apps/pwa/tests/pages/profile/index.test.tsx`

**Interfaces:**
- Consumes: Task 4 の `/profile/$userId/connections` ルート
- Produces: なし（この計画の最終成果）

- [ ] **Step 1: 失敗するテストを書く**

`apps/pwa/tests/pages/profile/index.test.tsx` の `describe` に2件足す。

```tsx
  it('フォロワー数から一覧ページへのリンクを張る', async () => {
    const ProfilePage = routeComponent(await import('@/pages/profile/$userId/index'))
    render(<ProfilePage />)
    expect(screen.getByRole('link', { name: /フォロワー/ })).toHaveAttribute(
      'href',
      '/profile/u2/connections',
    )
  })

  it('フォロー中数から一覧ページへのリンクを張る', async () => {
    const ProfilePage = routeComponent(await import('@/pages/profile/$userId/index'))
    render(<ProfilePage />)
    expect(screen.getByRole('link', { name: /フォロー中/ })).toHaveAttribute(
      'href',
      '/profile/u2/connections',
    )
  })
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `cd apps/pwa && pnpm test tests/pages/profile/index.test.tsx`
Expected: FAIL（`Unable to find an accessible element with the role "link"`）

- [ ] **Step 3: 件数表示をリンクにする**

`apps/pwa/src/pages/profile/$userId/index.tsx` の import に `Link` を足す。

```tsx
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
```

件数を表示している `<div className="flex gap-4 mt-2 text-sm" ...>` の中身（`<span>` 2つ）を差し替える。

```tsx
            <div className="flex gap-4 mt-2 text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
              <Link
                to="/profile/$userId/connections"
                params={{ userId: profile.id }}
                search={{ tab: 'followers' }}
              >
                <strong style={{ color: 'var(--sea-ink)' }}>{followerCount}</strong> フォロワー
              </Link>
              <Link
                to="/profile/$userId/connections"
                params={{ userId: profile.id }}
                search={{ tab: 'following' }}
              >
                <strong style={{ color: 'var(--sea-ink)' }}>{followingCount}</strong> フォロー中
              </Link>
            </div>
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd apps/pwa && pnpm test tests/pages/profile/index.test.tsx`
Expected: PASS（3 tests）

- [ ] **Step 5: 全件テストとビルド**

Run: リポジトリルートで `pnpm test`、続けて `cd apps/pwa && pnpm build`
Expected: 全テストパス、ビルド成功

- [ ] **Step 6: 実機で動作確認**

`/verify` スキル（Supabase ローカル + Vite dev + Playwright MCP）で以下を確認する。

1. `/profile/<他ユーザーのid>` を開き、フォロワー数/フォロー中数がリンクになっている
2. 「フォロワー」をクリックすると `/profile/<id>/connections?tab=followers` に遷移し、一覧が出る
3. タブを「フォロー中」に切り替えると URL の `tab` が変わり、一覧が入れ替わる
4. 一覧の行をクリックするとその人のプロフィールに遷移する
5. 一覧のフォローボタンでフォロー/解除ができる

- [ ] **Step 7: Commit**

```bash
git add apps/pwa/src/pages/profile apps/pwa/tests
git commit -m "feat: link the profile follower counts to the connections page"
```

---

## 完了後

PR #67 は draft のまま作られている。全タスク完了後に `gh pr ready 67` で review 可能にする。
