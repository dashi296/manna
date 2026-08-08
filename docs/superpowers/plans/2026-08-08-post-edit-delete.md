# 投稿の編集・削除導線 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 投稿詳細ページに「…」メニューを置き、自分の投稿の本文・公開範囲を編集し、確認を経て削除できるようにする。

**Architecture:** DB 側は RLS（`posts_update_own` / `posts_delete_own`）と `updated_at` トリガーが既にあるため、足すのは「`content` / `visibility` 以外の列を更新から守るトリガー」1本だけ。UI は新規 feature スライス `features/manage-post` にメニューと削除を閉じ込め、編集は既存の `PostComposerSheet` / `PostEditor` に編集モードを足して再利用する。FSD 上 features は widgets を import できないため、編集シートの開閉状態はページが持ち、メニューは `onEdit` コールバックを投げるだけにする。

**Tech Stack:** TanStack Start (React 19 / Vite) / Supabase (PostgreSQL + RLS) / Base UI + TailwindCSS v4 / Vitest + @testing-library/react

**Spec:** [`docs/superpowers/specs/2026-08-08-post-edit-delete-design.md`](../specs/2026-08-08-post-edit-delete-design.md)

## Global Constraints

- 作業ディレクトリは `/Users/shunokada/projects/manna`。ブランチは `post-edit-delete`（既にチェックアウト済み）
- テストは `pnpm test`（= `vitest run`）。単一ファイルは `pnpm --filter @manna/pwa exec vitest run <path>`
- 型チェックは `pnpm --filter @manna/pwa exec tsc --noEmit`。CI には無いが `strict` / `noUnusedLocals` が有効なので各タスクで回す
- テストは `apps/pwa/tests/` 下。`@` エイリアスは `apps/pwa/src`
- FSD のインポート方向: pages → widgets → features → entities → shared。逆流と同一層間の import を増やさない
- コメントは原則不要。WHY が自明でない場合のみ1行
- 新規 FSD スライスには必ず `index.ts` を作る
- UI 実装は TDD（失敗テスト → 実装 → 通過）
- 編集可能なフィールドは `content` と `visibility` のみ。聖典参照は不変
- DB リセットは `npx supabase db reset` ではなく `bash scripts/db-reset.sh` を使う（節データ 41,959 行が消えるため）

---

### Task 1: 列不変性トリガーのマイグレーション

`content` / `visibility` 以外の列を UPDATE から守る。`GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated` は列を指定しておらず、RLS は「どの行か」しか制限しないため、このトリガーが無いと本人が API を直接叩いて聖典参照や `created_at` を書き換えられる。

**Files:**
- Create: `supabase/migrations/20260808000001_protect_post_immutable_cols.sql`

**Interfaces:**
- Consumes: なし
- Produces: `public.protect_post_immutable_cols()` 関数と `posts_protect_immutable` トリガー。UI 側は `content` / `visibility` しか送らないので、通常フローでは発火しない

- [ ] **Step 1: マイグレーションファイルを作る**

`supabase/migrations/20260808000001_protect_post_immutable_cols.sql`:

```sql
-- posts は content / visibility 以外を更新できないようにする。
-- GRANT は列を指定せず UPDATE を許しており、RLS は「どの行か」しか制限しない。
-- 聖典参照を後から変えられると、章ページの節バブルから見て投稿が別の節へ移動する。
-- RLS の WITH CHECK では OLD を参照できないためトリガーで守る。
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

`updated_at` を検査対象に入れないこと。同じ `BEFORE UPDATE` の `posts_set_updated_at` が書き換える。トリガーは名前順に実行されるので `posts_protect_immutable` → `posts_set_updated_at` の順になり、この関数が見る `NEW.updated_at` はまだ古い値である。

- [ ] **Step 2: DB に適用する**

Run: `bash scripts/db-reset.sh`
Expected: エラーなく完了し、節データが復元される

- [ ] **Step 3: トリガーが効くことを手動で確認する**

Run:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -c "
INSERT INTO users (id, display_name) VALUES ('00000000-0000-0000-0000-000000000001', 'trigger test')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO posts (id, user_id, content, scripture_collection, scripture_book, scripture_chapter, scripture_verses)
  VALUES ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000001', 'before', 'bofm', '1-ne', 3, ARRAY[7])
  ON CONFLICT (id) DO NOTHING;
"
```

続けて、通す UPDATE:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -c "
UPDATE posts SET content = 'after', visibility = 'private' WHERE id = '00000000-0000-0000-0000-0000000000aa';
SELECT content, visibility, created_at <> updated_at AS touched FROM posts WHERE id = '00000000-0000-0000-0000-0000000000aa';
"
```

Expected: `after | private | t`

続けて、弾かれる UPDATE:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -c "
UPDATE posts SET scripture_verses = ARRAY[9] WHERE id = '00000000-0000-0000-0000-0000000000aa';
"
```

Expected: `ERROR:  only content and visibility may be updated on posts`

- [ ] **Step 4: 検証用の行を片付ける**

Run:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -c "
DELETE FROM posts WHERE id = '00000000-0000-0000-0000-0000000000aa';
DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001';
"
```

Expected: `DELETE 1` が2回

- [ ] **Step 5: コミット**

```bash
git add supabase/migrations/20260808000001_protect_post_immutable_cols.sql
git commit -m "feat(db): posts の content/visibility 以外を更新不可にする"
```

---

### Task 2: `entities/post` に `updated_at` と `EditablePost` を足す

`POST_SELECT` に `updated_at` を追加し、`PostWithUser` を必須フィールド1つ分広げる。既存テストが `PostWithUser` のリテラルを7ファイルで組み立てているので、同じタスクで全部直す（直さないと `tsc --noEmit` が落ちる。Vitest は型を見ないのでテスト実行では表面化しない）。

**Files:**
- Modify: `apps/pwa/src/entities/post/model.ts`
- Modify: `apps/pwa/src/entities/post/index.ts`
- Test: `apps/pwa/tests/entities/post/model.test.ts`
- Modify: `apps/pwa/tests/helpers/fixtures.ts`
- Modify: `apps/pwa/tests/pages/posts/id.test.tsx`
- Modify: `apps/pwa/tests/pages/scriptures/chapter.test.tsx`
- Modify: `apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx`
- Modify: `apps/pwa/tests/entities/post/CompactPostCard.test.tsx`
- Modify: `apps/pwa/tests/entities/post/PostCard.test.tsx`
- Modify: `apps/pwa/tests/entities/post/CommenterBubble.test.tsx`

**Interfaces:**
- Consumes: なし
- Produces:
  - `PostWithUser` に `updated_at: string` が追加される
  - `POST_SELECT` が `updated_at` を含む
  - `export type EditablePost = { id: string; content: string; visibility: Visibility }`（`@/entities/post` から import 可能）

- [ ] **Step 1: 失敗テストを書く**

`apps/pwa/tests/entities/post/model.test.ts` の先頭の import に `POST_SELECT` を足し、ファイル末尾に describe を追加する。

import 行を差し替える:

```ts
import { toScriptureRef, POST_SELECT, type PostWithUser } from '@/entities/post/model'
```

同ファイル内のローカル `makePost` に `updated_at` を足す（`created_at` の直後）:

```ts
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
```

ファイル末尾に追加:

```ts
describe('POST_SELECT', () => {
  it('updated_at を含む（「編集済み」表示が created_at との比較に使う）', () => {
    expect(POST_SELECT).toContain('updated_at')
  })
})
```

- [ ] **Step 2: テストを実行して落ちることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/entities/post/model.test.ts`
Expected: FAIL — `expected '...' to contain 'updated_at'`

- [ ] **Step 3: `entities/post/model.ts` を直す**

`PostWithUser` に `updated_at` を足す（`created_at` の直後）:

```ts
export type PostWithUser = {
  id: string
  content: string
  visibility: Visibility
  created_at: string
  updated_at: string
  scripture_collection: string | null
  scripture_book: string | null
  scripture_chapter: number | null
  scripture_verses: number[] | null
  user_id: string
  users: UserSummary | null
}

export type EditablePost = { id: string; content: string; visibility: Visibility }
```

`POST_SELECT` の1行目を差し替える:

```ts
export const POST_SELECT = `
  id, content, visibility, created_at, updated_at,
  scripture_collection, scripture_book, scripture_chapter,
  scripture_verses, user_id,
  users!posts_user_id_fkey ( display_name, avatar_url )
`
```

- [ ] **Step 4: `entities/post/index.ts` に export を足す**

1行目を差し替える:

```ts
export type { PostWithUser, EditablePost, Visibility } from './model'
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/entities/post/model.test.ts`
Expected: PASS

- [ ] **Step 6: 既存テストの `PostWithUser` リテラルに `updated_at` を足す**

以下の各ファイルで、`created_at:` の行の直後に同じ値の `updated_at:` を足す。「未編集」を表すため `created_at` と同値にする。

`apps/pwa/tests/helpers/fixtures.ts`:

```ts
  created_at: '2026-07-25T10:00:00+00:00',
  updated_at: '2026-07-25T10:00:00+00:00',
```

`apps/pwa/tests/pages/posts/id.test.tsx`（`basePost`）:

```ts
  created_at: '2026-05-31T10:00:00Z',
  updated_at: '2026-05-31T10:00:00Z',
```

`apps/pwa/tests/entities/post/PostCard.test.tsx`（`basePost`）:

```ts
  created_at: '2026-05-31T10:00:00Z',
  updated_at: '2026-05-31T10:00:00Z',
```

`apps/pwa/tests/entities/post/CompactPostCard.test.tsx`（`post`）:

```ts
  created_at: '2026-07-19T00:00:00.000Z',
  updated_at: '2026-07-19T00:00:00.000Z',
```

`apps/pwa/tests/entities/post/CommenterBubble.test.tsx`（`post`）:

```ts
  created_at: '2026-07-19T00:00:00.000Z',
  updated_at: '2026-07-19T00:00:00.000Z',
```

`apps/pwa/tests/widgets/verse-comment-sheet/VerseCommentSheet.test.tsx`（配列内の各要素）:

```ts
    created_at: '2026-07-19T00:00:00.000Z',
    updated_at: '2026-07-19T00:00:00.000Z',
```

`apps/pwa/tests/pages/scriptures/chapter.test.tsx`（3箇所。`created_at` の値がそれぞれ違うので、その行の値をそのままコピーする）:

```ts
          created_at: '2026-07-19T00:00:00.000Z',
          updated_at: '2026-07-19T00:00:00.000Z',
```

```ts
          created_at: '2026-07-19T00:00:00.000Z',
          updated_at: '2026-07-19T00:00:00.000Z',
```

```ts
          created_at: '2026-08-07T00:00:00.000Z',
          updated_at: '2026-08-07T00:00:00.000Z',
```

- [ ] **Step 7: 型チェックと全テストを回す**

Run: `pnpm --filter @manna/pwa exec tsc --noEmit`
Expected: エラーなし

Run: `pnpm test`
Expected: 全 PASS

- [ ] **Step 8: コミット**

```bash
git add apps/pwa/src/entities/post apps/pwa/tests
git commit -m "feat(post): PostWithUser に updated_at と EditablePost 型を足す"
```

---

### Task 3: `invalidatePostLists` を追加する

投稿の編集・削除で古くなるのはフィードとプロフィールの投稿一覧。`FEED` / `USER_POSTS` の定数がある `relationQueries.ts` に無効化関数を足す。詳細ページ（pages）と `useDeletePost`（features）の両方から呼ぶため、共通して import できる entities 層に置く。

**Files:**
- Modify: `apps/pwa/src/entities/user/model/relationQueries.ts`
- Modify: `apps/pwa/src/entities/user/index.ts`
- Test: `apps/pwa/tests/entities/user/relationQueries.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `invalidatePostLists(queryClient: QueryClient): Promise<unknown>`（`@/entities/user` から import 可能）。`['user-posts']` と `['feed']` のプレフィックスを無効化する

- [ ] **Step 1: 失敗テストを書く**

`apps/pwa/tests/entities/user/relationQueries.test.ts` の末尾に追加する:

```ts
describe('invalidatePostLists', () => {
  const invalidatedPostPrefixes = async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    await relationQueries.invalidatePostLists({ invalidateQueries } as unknown as QueryClient)
    return invalidateQueries.mock.calls.map((call) => call[0].queryKey)
  }

  it('投稿一覧のプレフィックスだけを落とす', async () => {
    const prefixes = await invalidatedPostPrefixes()

    expect(prefixes).toEqual([['user-posts'], ['feed']])
  })

  it('プロフィールとコネクションは落とさない（投稿の編集で古くならない）', async () => {
    const heads = (await invalidatedPostPrefixes()).map(([head]) => head)

    expect(heads).not.toContain('profile')
    expect(heads).not.toContain('connections')
  })
})
```

- [ ] **Step 2: テストを実行して落ちることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/entities/user/relationQueries.test.ts`
Expected: FAIL — `relationQueries.invalidatePostLists is not a function`

- [ ] **Step 3: `relationQueries.ts` に関数を足す**

ファイル末尾に追加する:

```ts
// 投稿の作成・編集・削除で古くなる一覧。tab / userId を知らなくて済むよう
// プレフィックスで落とす。フォロー関係は変わらないので profile / connections は残す
export function invalidatePostLists(queryClient: QueryClient) {
  return Promise.all(
    [USER_POSTS, FEED].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  )
}
```

- [ ] **Step 4: `entities/user/index.ts` から export する**

`profileKey` などを出している行を差し替える:

```ts
export { profileKey, connectionsKey, userPostsKey, feedKey, invalidatePostLists } from './model/relationQueries'
```

- [ ] **Step 5: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/entities/user/relationQueries.test.ts`
Expected: PASS（既存の `invalidateRelationQueries` の2件も引き続き PASS）

- [ ] **Step 6: コミット**

```bash
git add apps/pwa/src/entities/user apps/pwa/tests/entities/user
git commit -m "feat(user): 投稿一覧だけを落とす invalidatePostLists を足す"
```

---

### Task 4: `PostEditor` に編集モードを足す

`post` prop が渡されたら編集モードになる。初期値は `post` から取り、localStorage ドラフトには一切触らず、`ScriptureSelector` の代わりに読み取り専用チップを出し、`update` を送る。

**Files:**
- Modify: `apps/pwa/src/widgets/post-editor/ui/PostEditor.tsx`
- Test: `apps/pwa/tests/widgets/post-editor/PostEditor.test.tsx`

**Interfaces:**
- Consumes: `EditablePost`（Task 2）
- Produces: `PostEditor` の props が `{ initialScripture?: ScriptureRefPartial; mode?: 'page' | 'sheet'; post?: EditablePost; onSuccess?: () => void }` になる。編集成功時は `onSuccess()` を呼ぶだけで、navigate もキャッシュ無効化もしない

- [ ] **Step 1: 失敗テストを書く**

`apps/pwa/tests/widgets/post-editor/PostEditor.test.tsx` の supabase モックを差し替える。既存の `vi.mock('@/shared/lib/supabase', ...)` ブロックと mock 宣言を、次の内容に置き換える:

```ts
const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })
const mockNavigate = vi.fn()

// update は .eq('id', ...).select('id') で終わる。引数を検証したいので eq もスパイする
const mockUpdate = vi.fn()
const mockUpdateEq = vi.fn()
const mockUpdateResult = vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null })

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      update: (values: unknown) => {
        mockUpdate(values)
        return {
          eq: (column: string, value: unknown) => {
            mockUpdateEq(column, value)
            return { select: () => mockUpdateResult() }
          },
        }
      },
    }),
    auth: { getUser: () => mockGetUser() },
  },
}))
```

`beforeEach` に3つの mock のリセットを足す:

```ts
    mockUpdate.mockClear()
    mockUpdateEq.mockClear()
    mockUpdateResult.mockClear().mockResolvedValue({ data: [{ id: 'p1' }], error: null })
```

ファイル末尾に describe を追加する:

```ts
describe('PostEditor（編集モード）', () => {
  const editablePost = { id: 'p1', content: '元の本文', visibility: 'public' as const }
  const scripture = { collection: 'bofm', book: 'mosiah', chapter: 3, verses: [19] }

  it('post の内容を初期値として表示する', () => {
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={() => {}} />)

    expect(screen.getByPlaceholderText(/感じたこと/)).toHaveValue('元の本文')
  })

  it('ボタンのラベルが「更新する」になる', () => {
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={() => {}} />)

    expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '投稿する' })).toBeNull()
  })

  it('本文も公開範囲も変えていない間は更新できない', () => {
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={() => {}} />)

    expect(screen.getByRole('button', { name: '更新する' })).toBeDisabled()
  })

  it('localStorage の下書きを読まない', () => {
    localStorage.setItem(
      'manna:post-draft:bofm:mosiah:3:19',
      JSON.stringify({ content: '書きかけの新規投稿', visibility: 'public', scripture }),
    )

    render(
      <PostEditor mode="sheet" post={editablePost} initialScripture={scripture} onSuccess={() => {}} />,
    )

    expect(screen.getByPlaceholderText(/感じたこと/)).toHaveValue('元の本文')
  })

  it('localStorage の下書きを書き換えない', async () => {
    const user = userEvent.setup()
    const draft = JSON.stringify({ content: '書きかけの新規投稿', visibility: 'public', scripture })
    localStorage.setItem('manna:post-draft:bofm:mosiah:3:19', draft)

    render(
      <PostEditor mode="sheet" post={editablePost} initialScripture={scripture} onSuccess={() => {}} />,
    )
    await user.type(screen.getByPlaceholderText(/感じたこと/), '追記')

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '更新する' })).not.toBeDisabled(),
    )
    expect(localStorage.getItem('manna:post-draft:bofm:mosiah:3:19')).toBe(draft)
  })

  it('聖典参照は編集させず、ラベルだけ表示する', () => {
    render(
      <PostEditor mode="sheet" post={editablePost} initialScripture={scripture} onSuccess={() => {}} />,
    )

    expect(screen.getByText(/モーサヤ書 3:19/)).toBeInTheDocument()
    expect(screen.queryByText('聖典参照（任意）')).toBeNull()
  })

  it('更新すると content と visibility だけを id 指定で送り、onSuccess を呼ぶ', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={onSuccess} />)

    await user.type(screen.getByPlaceholderText(/感じたこと/), 'を直した')
    await user.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    expect(mockUpdate).toHaveBeenCalledWith({ content: '元の本文を直した', visibility: 'public' })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'p1')
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('更新が失敗したらエラーを出して onSuccess を呼ばない', async () => {
    const user = userEvent.setup()
    mockUpdateResult.mockResolvedValue({ data: null, error: { message: 'update failed' } })
    const onSuccess = vi.fn()
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={onSuccess} />)

    await user.type(screen.getByPlaceholderText(/感じたこと/), 'を直した')
    await user.click(screen.getByRole('button', { name: '更新する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/更新に失敗/)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('0 行しか返らなければ失敗として扱う', async () => {
    const user = userEvent.setup()
    mockUpdateResult.mockResolvedValue({ data: [], error: null })
    const onSuccess = vi.fn()
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={onSuccess} />)

    await user.type(screen.getByPlaceholderText(/感じたこと/), 'を直した')
    await user.click(screen.getByRole('button', { name: '更新する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/更新に失敗/)
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: テストを実行して落ちることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/widgets/post-editor/PostEditor.test.tsx`
Expected: FAIL — 編集モード側の8件が落ちる（`toHaveValue('元の本文')` が空文字、「更新する」ボタンが見つからない等）。既存の新規投稿5件は PASS のまま

- [ ] **Step 3: `PostEditor.tsx` を書き換える**

import に `getScriptureLabel` と `EditablePost` を足す:

```ts
import type { EditablePost, Visibility } from '@/entities/post'
import { getScriptureLabel } from '@/entities/scripture'
```

（既存の `import type { Visibility } from '@/entities/post'` は上の行に統合して消す）

props を差し替える:

```ts
type Props = {
  initialScripture?: ScriptureRefPartial
  mode?: 'page' | 'sheet'
  post?: EditablePost
  onSuccess?: () => void
}

export function PostEditor({ initialScripture, mode = 'page', post, onSuccess }: Props) {
  const isEditing = post !== undefined
```

初期値ロードの `useEffect` を差し替える:

```ts
  useEffect(() => {
    if (post) {
      setContent(post.content)
      setVisibility(post.visibility)
      setScripture(initialScripture ?? {})
      return
    }
    const key = draftKey(mode, initialScripture ?? {})
    const draft = loadDraft(key)
    setContent(draft.content)
    setVisibility(draft.visibility)
    setScripture(initialScripture?.collection ? initialScripture : draft.scripture)
    draftLoaded.current = true
  }, [])
```

`draftLoaded.current` を編集モードでは立てないので、保存側の `useEffect` は既存のガードだけで書き込まなくなる（先頭が `if (!draftLoaded.current) return`）。

`handleSubmit` を差し替える:

```ts
  const handleSubmit = async () => {
    if (!content.trim() || submitting) return
    setSubmitting(true)
    setErrorMessage(null)

    if (post) {
      const { data, error } = await supabase
        .from('posts')
        .update({ content, visibility })
        .eq('id', post.id)
        .select('id')

      // RLS 違反はエラーではなく 0 行で返るため、行数でも判定する
      if (error || !data || data.length === 0) {
        setSubmitting(false)
        setErrorMessage('更新に失敗しました。もう一度お試しください。')
        return
      }
      onSuccess?.()
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      setErrorMessage('投稿するにはログインが必要です。')
      return
    }

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      content,
      visibility,
      scripture_collection: scripture.collection ?? null,
      scripture_book: scripture.book ?? null,
      scripture_chapter: scripture.chapter ?? null,
      scripture_verses: scripture.verses ?? null,
    })

    if (error) {
      setSubmitting(false)
      setErrorMessage('投稿に失敗しました。もう一度お試しください。')
      return
    }

    localStorage.removeItem(draftKey(mode, scripture))
    if (onSuccess) {
      onSuccess()
    } else {
      navigate({ to: '/' })
    }
  }
```

`handleSubmit` の直前に差分判定を足す。`isEditing` では `post` が narrow されないので `post !== undefined` を直接書く:

```ts
  const unchanged =
    post !== undefined && content === post.content && visibility === post.visibility
```

聖典参照ブロックを差し替える（`<div className="space-y-4">` の中の最初の `<div>`）:

```tsx
        <div>
          {isEditing ? (
            scriptureLabel && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{ background: 'var(--chip-bg)', border: '1px solid var(--chip-line)', color: 'var(--palm)' }}
              >
                <span aria-hidden="true">📖</span> {scriptureLabel}
              </span>
            )
          ) : (
            <>
              <p className="text-xs font-medium mb-2" style={softTextStyle}>
                聖典参照（任意）
              </p>
              <ScriptureSelector value={scripture} onChange={setScripture} />
            </>
          )}
        </div>
```

`scriptureLabel` を `return` の直前で作る:

```ts
  const scriptureLabel =
    isEditing && initialScripture?.collection && initialScripture.book
      ? getScriptureLabel({
          collection: initialScripture.collection,
          book: initialScripture.book,
          chapter: initialScripture.chapter,
          verses: initialScripture.verses,
        })
      : null
```

送信ボタンを差し替える:

```tsx
      <Button
        onClick={handleSubmit}
        disabled={!content.trim() || submitting || unchanged}
        className="w-full"
      >
        {isEditing
          ? (submitting ? '更新中...' : '更新する')
          : (submitting ? '投稿中...' : '投稿する')}
      </Button>
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/widgets/post-editor/PostEditor.test.tsx`
Expected: 全 PASS（新規投稿5件 + 編集9件）

- [ ] **Step 5: 型チェック**

Run: `pnpm --filter @manna/pwa exec tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add apps/pwa/src/widgets/post-editor apps/pwa/tests/widgets/post-editor
git commit -m "feat(post-editor): 編集モードを足す"
```

---

### Task 5: `PostComposerSheet` に `post` prop を通す

`post` があればタイトルを「投稿を編集」に固定し、`PostEditor` へ素通しする。history 制御は変えない。

**Files:**
- Modify: `apps/pwa/src/widgets/post-composer-sheet/ui/PostComposerSheet.tsx`
- Test: `apps/pwa/tests/widgets/post-composer-sheet/PostComposerSheet.test.tsx`

**Interfaces:**
- Consumes: `EditablePost`（Task 2）、`PostEditor` の `post` prop（Task 4）
- Produces: `PostComposerSheet` の props に `post?: EditablePost` が加わる

- [ ] **Step 1: 失敗テストを書く**

`apps/pwa/tests/widgets/post-composer-sheet/PostComposerSheet.test.tsx` の supabase モックに `update` を足す（`PostEditor` が編集モードで参照するため。呼ばれない想定だが `from()` の戻りに無いと落ちる）:

```ts
vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      update: () => ({ eq: () => ({ select: async () => ({ data: [{ id: 'p1' }], error: null }) }) }),
    }),
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  },
}))
```

ファイル末尾の `describe` 内に追加する:

```ts
  it('post があるとタイトルが「投稿を編集」になる', () => {
    render(
      <PostComposerSheet
        open
        onOpenChange={() => {}}
        post={{ id: 'p1', content: '元の本文', visibility: 'public' }}
        initialScripture={{ collection: 'bofm', book: 'mosiah', chapter: 3, verses: [19] }}
      />,
    )

    expect(screen.getByText('投稿を編集')).toBeInTheDocument()
    expect(screen.queryByText('新しい投稿')).toBeNull()
  })

  it('post を PostEditor に渡す（本文が初期表示される）', () => {
    render(
      <PostComposerSheet
        open
        onOpenChange={() => {}}
        post={{ id: 'p1', content: '元の本文', visibility: 'public' }}
      />,
    )

    expect(screen.getByPlaceholderText(/感じたこと/)).toHaveValue('元の本文')
  })
```

- [ ] **Step 2: テストを実行して落ちることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/widgets/post-composer-sheet/PostComposerSheet.test.tsx`
Expected: FAIL — `post` が unknown prop で TS エラー、実行時も「投稿を編集」が見つからない

- [ ] **Step 3: `PostComposerSheet.tsx` を書き換える**

import に型を足す:

```ts
import type { EditablePost } from '@/entities/post'
```

props に `post` を足す（`initialScripture` の直後）:

```ts
  initialScripture?: ScriptureRefPartial
  post?: EditablePost
```

分割代入を差し替える:

```ts
export function PostComposerSheet({ open, onOpenChange, initialScripture, post, onClosed }: Props) {
```

タイトルの算出を差し替える:

```ts
  const title = post
    ? '投稿を編集'
    : initialScripture?.collection && initialScripture.book
      ? `📖 ${getScriptureLabel({
          collection: initialScripture.collection,
          book: initialScripture.book,
          chapter: initialScripture.chapter,
          verses: initialScripture.verses,
        })}`
      : '新しい投稿'
```

`PostEditor` に渡す:

```tsx
          <PostEditor
            initialScripture={initialScripture}
            mode="sheet"
            post={post}
            onSuccess={() => onOpenChange(false)}
          />
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/widgets/post-composer-sheet/PostComposerSheet.test.tsx`
Expected: 全 PASS

- [ ] **Step 5: コミット**

```bash
git add apps/pwa/src/widgets/post-composer-sheet apps/pwa/tests/widgets/post-composer-sheet
git commit -m "feat(post-composer-sheet): 編集モードの post prop を通す"
```

---

### Task 6: テストヘルパーに `useRouter` を足す

Task 7 の `useDeletePost` が `useRouter().history` を使う。`routerMock` は今 `useRouter` を返していないので、先に足しておく。

**Files:**
- Modify: `apps/pwa/tests/helpers/tanstack.tsx`

**Interfaces:**
- Consumes: なし
- Produces: `routerMock(...)` の戻りに `useRouter` が加わる。第5引数 `router` で `{ invalidate, history: { canGoBack, back } }` を差し替えられる。省略時は `invalidate` / `back` が no-op、`canGoBack()` は `true`

- [ ] **Step 1: `routerMock` に `useRouter` を足す**

`apps/pwa/tests/helpers/tanstack.tsx` の `routerMock` シグネチャの末尾に引数を1つ足す:

```ts
export function routerMock(
  useLoaderData: () => unknown = () => ({}),
  getPathname: () => string = () => '/',
  navigate: (opts: unknown) => void = () => {},
  // loader ではなく params/search からデータを組み立てるページ用。渡さなければ空を返す
  routeHooks: { useParams?: () => unknown; useSearch?: () => unknown } = {},
  // 削除フローのように router.invalidate() / history.back() を叩くコンポーネント用
  router: {
    invalidate?: () => void
    canGoBack?: () => boolean
    back?: () => void
  } = {},
) {
```

返すオブジェクトの `useNavigate` の直後に足す:

```ts
    useRouter: () => ({
      invalidate: router.invalidate ?? (() => {}),
      history: {
        canGoBack: router.canGoBack ?? (() => true),
        back: router.back ?? (() => {}),
      },
    }),
```

- [ ] **Step 2: 既存テストが壊れていないことを確認する**

Run: `pnpm test`
Expected: 全 PASS（引数を足しただけなので既存の呼び出しは影響を受けない）

- [ ] **Step 3: コミット**

```bash
git add apps/pwa/tests/helpers/tanstack.tsx
git commit -m "test: routerMock に useRouter を足す"
```

---

### Task 7: `features/manage-post` スライスを作る

「…」メニュー、削除確認シート、削除ミューテーションをまとめる。編集は `onEdit` コールバックで外へ投げるだけ（features は widgets を import できないため）。

**Files:**
- Create: `apps/pwa/src/features/manage-post/index.ts`
- Create: `apps/pwa/src/features/manage-post/model/useDeletePost.ts`
- Create: `apps/pwa/src/features/manage-post/ui/DeletePostSheet.tsx`
- Create: `apps/pwa/src/features/manage-post/ui/PostActionsMenu.tsx`
- Test: `apps/pwa/tests/features/manage-post/PostActionsMenu.test.tsx`

**Interfaces:**
- Consumes: `invalidatePostLists`（Task 3）、`routerMock` の `useRouter`（Task 6）
- Produces: `PostActionsMenu`（`@/features/manage-post` から import 可能）。props は `{ postId: string; onEdit: () => void }`

- [ ] **Step 1: 失敗テストを書く**

`apps/pwa/tests/features/manage-post/PostActionsMenu.test.tsx` を新規作成する:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PostActionsMenu } from '@/features/manage-post'
import { renderWithQueryClient } from '../../helpers/query'

const mockDelete = vi.fn()
const mockDeleteEq = vi.fn()
const mockDeleteResult = vi.fn()
const mockInvalidate = vi.fn()
const mockBack = vi.fn()
const mockCanGoBack = vi.fn()
const mockNavigate = vi.fn()
const mockToastError = vi.fn()
const mockToast = vi.fn()

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      delete: () => {
        mockDelete()
        return {
          eq: (column: string, value: unknown) => {
            mockDeleteEq(column, value)
            return { select: () => mockDeleteResult() }
          },
        }
      },
    }),
  },
}))

vi.mock('@/shared/ui/sonner', () => ({
  toast: Object.assign((msg: string) => mockToast(msg), { error: (msg: string) => mockToastError(msg) }),
}))

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(
    undefined,
    undefined,
    (opts) => mockNavigate(opts),
    undefined,
    { invalidate: () => mockInvalidate(), canGoBack: () => mockCanGoBack(), back: () => mockBack() },
  ),
)

const renderMenu = (onEdit = vi.fn()) => {
  renderWithQueryClient(() => <PostActionsMenu postId="p1" onEdit={onEdit} />)
  return onEdit
}

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { name: '投稿の操作' }))
  return await screen.findByRole('menu')
}

// Base UI の Popover Popup も role="dialog" を持つため、findByRole('dialog') は
// メニューの残骸と衝突しうる。確認シートは data-slot で一意に取る
const openConfirmSheet = async () => {
  const menu = await openMenu()
  await userEvent.click(within(menu).getByRole('menuitem', { name: '削除' }))
  const title = await screen.findByText('投稿を削除しますか？')
  return title.closest('[data-slot="sheet-content"]') as HTMLElement
}

describe('PostActionsMenu', () => {
  beforeEach(() => {
    mockDelete.mockClear()
    mockDeleteEq.mockClear()
    mockDeleteResult.mockClear().mockResolvedValue({ data: [{ id: 'p1' }], error: null })
    mockInvalidate.mockClear()
    mockBack.mockClear()
    mockCanGoBack.mockClear().mockReturnValue(true)
    mockNavigate.mockClear()
    mockToast.mockClear()
    mockToastError.mockClear()
  })

  it('開くまでメニュー項目は出ない', () => {
    renderMenu()

    expect(screen.queryByRole('menuitem', { name: '編集' })).toBeNull()
  })

  it('「編集」で onEdit を呼ぶ（削除はしない）', async () => {
    const onEdit = renderMenu()
    const menu = await openMenu()

    await userEvent.click(within(menu).getByRole('menuitem', { name: '編集' }))

    expect(onEdit).toHaveBeenCalledOnce()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('「削除」ではまだ削除せず確認シートを出す', async () => {
    renderMenu()

    const sheet = await openConfirmSheet()

    expect(within(sheet).getByText('削除した投稿は元に戻せません')).toBeInTheDocument()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('キャンセルでは削除しない', async () => {
    renderMenu()
    const sheet = await openConfirmSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: 'キャンセル' }))

    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('確認すると id 指定で削除し、一覧を落として直前の画面へ戻る', async () => {
    renderMenu()
    const sheet = await openConfirmSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: '削除する' }))

    await waitFor(() => expect(mockBack).toHaveBeenCalledOnce())
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'p1')
    expect(mockToast).toHaveBeenCalledWith('投稿を削除しました')
    expect(mockInvalidate).toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('戻れる履歴が無ければフィードへ送る', async () => {
    mockCanGoBack.mockReturnValue(false)
    renderMenu()
    const sheet = await openConfirmSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: '削除する' }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/' }))
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('0 行なら既に削除済みとして扱い、エラーにしない', async () => {
    mockDeleteResult.mockResolvedValue({ data: [], error: null })
    renderMenu()
    const sheet = await openConfirmSheet()

    await userEvent.click(within(sheet).getByRole('button', { name: '削除する' }))

    await waitFor(() => expect(mockBack).toHaveBeenCalledOnce())
    expect(mockToast).toHaveBeenCalledWith('投稿は既に削除されています')
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('失敗したら遷移せず、もう一度押せる状態に戻す', async () => {
    mockDeleteResult.mockResolvedValue({ data: null, error: { message: 'boom' } })
    renderMenu()
    const sheet = await openConfirmSheet()
    const confirm = within(sheet).getByRole('button', { name: '削除する' })

    await userEvent.click(confirm)

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('削除に失敗しました'))
    expect(mockBack).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(confirm).not.toBeDisabled()
  })
})
```

- [ ] **Step 2: テストを実行して落ちることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/features/manage-post/PostActionsMenu.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/manage-post"`

- [ ] **Step 3: `useDeletePost` を作る**

`apps/pwa/src/features/manage-post/model/useDeletePost.ts`:

```ts
import { useState } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { invalidatePostLists } from '@/entities/user'
import { supabase } from '@/shared/lib/supabase'
import { toast } from '@/shared/ui/sonner'

export function useDeletePost(postId: string) {
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const remove = async () => {
    if (pending) return
    setPending(true)

    const { data, error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .select('id')

    if (error) {
      setPending(false)
      toast.error('削除に失敗しました')
      return
    }

    // RLS 違反も別セッションでの削除済みも 0 行で返る。削除の意図は達成されて
    // いるので、どちらもエラーにせず一覧を取り直して戻す
    toast(data && data.length > 0 ? '投稿を削除しました' : '投稿は既に削除されています')

    await invalidatePostLists(queryClient)
    router.invalidate()

    if (router.history.canGoBack()) router.history.back()
    else navigate({ to: '/' })
  }

  return { remove, pending }
}
```

- [ ] **Step 4: `DeletePostSheet` を作る**

`apps/pwa/src/features/manage-post/ui/DeletePostSheet.tsx`:

```tsx
import { Button } from '@/shared/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'
import { useDeletePost } from '../model/useDeletePost'

type Props = {
  postId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeletePostSheet({ postId, open, onOpenChange }: Props) {
  const { remove, pending } = useDeletePost(postId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-6" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>投稿を削除しますか？</SheetTitle>
          <SheetDescription>削除した投稿は元に戻せません</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button onClick={remove} disabled={pending} variant="destructive">
            削除する
          </Button>
          <SheetClose render={<Button variant="outline" />}>キャンセル</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 5: `PostActionsMenu` を作る**

`apps/pwa/src/features/manage-post/ui/PostActionsMenu.tsx`:

```tsx
import { useState, type ReactNode } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { DeletePostSheet } from './DeletePostSheet'

type Props = {
  postId: string
  onEdit: () => void
}

export function PostActionsMenu({ postId, onEdit }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleEdit = () => {
    setMenuOpen(false)
    onEdit()
  }
  const handleDelete = () => {
    setMenuOpen(false)
    setConfirmOpen(true)
  }

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          className="flex items-center justify-center size-8 rounded-full hover:bg-muted transition-colors"
          aria-label="投稿の操作"
          aria-haspopup="menu"
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-40">
          <div className="flex flex-col" role="menu">
            <MenuItem
              icon={<Pencil size={16} aria-hidden="true" />}
              label="編集"
              onClick={handleEdit}
            />
            <MenuItem
              icon={<Trash2 size={16} aria-hidden="true" />}
              label="削除"
              onClick={handleDelete}
              className="text-destructive"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Popover の中に置くと、閉じた瞬間に unmount されてシートごと消える */}
      <DeletePostSheet postId={postId} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </>
  )
}

type MenuItemProps = {
  icon: ReactNode
  label: string
  onClick: () => void
  className?: string
}

function MenuItem({ icon, label, onClick, className }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-sm text-sm hover:bg-muted transition-colors text-left ${className ?? ''}`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
```

- [ ] **Step 6: `index.ts` を作る**

`apps/pwa/src/features/manage-post/index.ts`:

```ts
export { PostActionsMenu } from './ui/PostActionsMenu'
```

- [ ] **Step 7: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/features/manage-post/PostActionsMenu.test.tsx`
Expected: 全 PASS（8件）

- [ ] **Step 8: 型チェック**

Run: `pnpm --filter @manna/pwa exec tsc --noEmit`
Expected: エラーなし

- [ ] **Step 9: コミット**

```bash
git add apps/pwa/src/features/manage-post apps/pwa/tests/features/manage-post
git commit -m "feat(manage-post): 投稿の操作メニューと削除フローを足す"
```

---

### Task 8: 投稿詳細ページに導線を組み込む

viewer の id をサーバー側で取り、自分の投稿ならヘッダーにメニューを出す。編集シートの開閉はページが持ち、更新成功時にルートとキャッシュを取り直す。「編集済み」も出す。

**Files:**
- Modify: `apps/pwa/src/pages/posts/$id.tsx`
- Test: `apps/pwa/tests/pages/posts/id.test.tsx`

**Interfaces:**
- Consumes: `PostActionsMenu`（Task 7）、`PostComposerSheet` の `post` prop（Task 5）、`invalidatePostLists`（Task 3）、`PostWithUser.updated_at`（Task 2）
- Produces: `fetchPost` の戻りが `{ post: PostWithUser | null; viewerId: string | null }` になり、loader は `{ post, viewerId }` を返す

- [ ] **Step 1: 失敗テストを書く**

`apps/pwa/tests/pages/posts/id.test.tsx` を丸ごと差し替える:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PostWithUser } from '@/entities/post'
import { routeComponent } from '../../helpers/tanstack'
import { renderWithQueryClient } from '../../helpers/query'

const basePost: PostWithUser = {
  id: 'post-1',
  content: 'これは試験投稿の本文です。',
  visibility: 'public',
  created_at: '2026-05-31T10:00:00Z',
  updated_at: '2026-05-31T10:00:00Z',
  scripture_collection: 'bofm',
  scripture_book: '1-ne',
  scripture_chapter: 3,
  scripture_verses: [7],
  user_id: 'user-1',
  users: { display_name: 'テスト太郎', avatar_url: null },
}

let loaderData: { post: PostWithUser; viewerId: string | null } = {
  post: basePost,
  viewerId: null,
}

vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(() => loaderData),
)

vi.mock('@tanstack/react-start', async () => (await import('../../helpers/tanstack')).startMock())

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => ({ select: async () => ({ data: [{ id: 'post-1' }], error: null }) }) }),
      delete: () => ({ eq: () => ({ select: async () => ({ data: [{ id: 'post-1' }], error: null }) }) }),
    }),
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  },
}))

let PostDetailPage: React.ComponentType

const renderPage = () => renderWithQueryClient(() => <PostDetailPage />)

describe('PostDetailPage', () => {
  beforeEach(async () => {
    loaderData = { post: basePost, viewerId: null }
    PostDetailPage = routeComponent(await import('@/pages/posts/$id'))
  })

  it('投稿本文を表示する', () => {
    renderPage()
    expect(screen.getByText('これは試験投稿の本文です。')).toBeInTheDocument()
  })

  it('投稿者名を表示する', () => {
    renderPage()
    expect(screen.getByText('テスト太郎')).toBeInTheDocument()
  })

  it('聖典参照ラベルと公式サイトへのリンクを表示する', () => {
    renderPage()
    expect(screen.getByText(/第1ニーファイ書/)).toBeInTheDocument()
    expect(screen.getByText('公式サイトで読む →')).toHaveAttribute(
      'href',
      expect.stringContaining('churchofjesuschrist.org'),
    )
  })

  it('フィードへの戻るリンクを表示する', () => {
    renderPage()
    expect(screen.getByText('フィード')).toBeInTheDocument()
  })

  it('他人の投稿では操作メニューを出さない', () => {
    loaderData = { post: basePost, viewerId: 'someone-else' }
    renderPage()
    expect(screen.queryByRole('button', { name: '投稿の操作' })).toBeNull()
  })

  it('未ログインでは操作メニューを出さない', () => {
    loaderData = { post: basePost, viewerId: null }
    renderPage()
    expect(screen.queryByRole('button', { name: '投稿の操作' })).toBeNull()
  })

  it('自分の投稿では操作メニューを出す', () => {
    loaderData = { post: basePost, viewerId: 'user-1' }
    renderPage()
    expect(screen.getByRole('button', { name: '投稿の操作' })).toBeInTheDocument()
  })

  it('「編集」で編集シートが開き、本文が初期表示される', async () => {
    loaderData = { post: basePost, viewerId: 'user-1' }
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: '投稿の操作' }))
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: '編集' }))

    expect(screen.getByText('投稿を編集')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/感じたこと/)).toHaveValue('これは試験投稿の本文です。')
  })

  it('未編集の投稿には「編集済み」を出さない', () => {
    renderPage()
    expect(screen.queryByText('編集済み')).toBeNull()
  })

  it('updated_at が created_at と違えば「編集済み」を出す', () => {
    loaderData = {
      post: { ...basePost, updated_at: '2026-06-01T09:00:00Z' },
      viewerId: null,
    }
    renderPage()
    expect(screen.getByText('編集済み')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストを実行して落ちることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/pages/posts/id.test.tsx`
Expected: FAIL — 既存4件は PASS、新規6件のうち「自分の投稿では操作メニューを出す」以降が落ちる（`loaderData` の形が変わったので `post` が undefined になり、最初の4件も落ちる可能性がある。その場合も Step 3 で直る）

- [ ] **Step 3: `pages/posts/$id.tsx` を書き換える**

import を差し替える:

```tsx
import { useState } from 'react'
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { POST_SELECT, toScriptureRef, type PostWithUser } from '@/entities/post'
import { getScriptureLabel, buildScriptureUrl, getBook } from '@/entities/scripture'
import { invalidatePostLists } from '@/entities/user'
import { PostActionsMenu } from '@/features/manage-post'
import { PostComposerSheet } from '@/widgets/post-composer-sheet'
import { MarkdownRenderer, PageHeader, UserAvatar } from '@/shared/ui'
import { resolveUserIdentity } from '@/shared/lib/constants'
import { formatDate } from '@/shared/lib/date'
import { createSupabaseServer } from '@/shared/lib/auth'
```

`fetchPost` のハンドラを差し替える:

```ts
const fetchPost = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string }) => data)
  .handler(async (ctx) => {
    const serverSupabase = await createSupabaseServer()
    // maybeSingle は0件を null で返すので loader が 404 にできる。single だと0件も
    // error になり、throwOnError と併せると 404 が 500 に化ける
    const [{ data: post }, { data: { user } }] = await Promise.all([
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('id', ctx.data.id)
        .maybeSingle()
        .throwOnError(),
      serverSupabase.auth.getUser(),
    ])
    return { post: post as PostWithUser | null, viewerId: user?.id ?? null }
  })
```

loader を差し替える:

```ts
  loader: async ({ params }) => {
    const { post, viewerId } = await fetchPost({ data: { id: params.id } })
    if (!post) throw notFound()
    return { post, viewerId }
  },
```

コンポーネント冒頭を差し替える:

```tsx
function PostDetailPage() {
  const { post, viewerId } = Route.useLoaderData()
  const { displayName, avatarUrl } = resolveUserIdentity(post.users)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const isOwner = viewerId !== null && viewerId === post.user_id
  const isEdited = post.updated_at !== post.created_at

  const scriptureRef = toScriptureRef(post)
  const scriptureBook = scriptureRef ? getBook(scriptureRef.collection, scriptureRef.book) : undefined
  const scriptureLabel = scriptureRef ? getScriptureLabel(scriptureRef, scriptureBook) : null
  const officialUrl = scriptureRef ? buildScriptureUrl(scriptureRef, scriptureBook) : null

  // PostEditor は更新成功時もキャンセル時も onOpenChange(false) を通るため、
  // 閉じたら常に取り直す。キャンセル時の1回は無駄になるが、更新の取りこぼしより安い
  const handleEditorOpenChange = (open: boolean) => {
    setEditing(open)
    if (open) return
    invalidatePostLists(queryClient)
    router.invalidate()
  }
```

`PageHeader` に `action` を渡す:

```tsx
      <PageHeader
        title="投稿"
        backTo="/"
        backLabel="フィード"
        action={
          isOwner ? <PostActionsMenu postId={post.id} onEdit={() => setEditing(true)} /> : undefined
        }
      />
```

投稿日時の行に「編集済み」を足す:

```tsx
            <div className="text-xs" style={{ color: 'var(--sea-ink-soft)' }}>
              {formatDate(post.created_at, { year: true })}
              {isEdited && <span className="ml-1">編集済み</span>}
            </div>
```

`<MarkdownRenderer content={post.content} />` の直後（`</div>` の前）に編集シートを足す:

```tsx
        {isOwner && (
          <PostComposerSheet
            open={editing}
            onOpenChange={handleEditorOpenChange}
            post={{ id: post.id, content: post.content, visibility: post.visibility }}
            initialScripture={scriptureRef ?? undefined}
          />
        )}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `pnpm --filter @manna/pwa exec vitest run tests/pages/posts/id.test.tsx`
Expected: 全 PASS（10件）

- [ ] **Step 5: 型チェックと全テスト**

Run: `pnpm --filter @manna/pwa exec tsc --noEmit`
Expected: エラーなし

Run: `pnpm test`
Expected: 全 PASS

- [ ] **Step 6: コミット**

```bash
git add apps/pwa/src/pages/posts apps/pwa/tests/pages/posts
git commit -m "feat(posts): 投稿詳細に編集・削除の導線を足す"
```

---

### Task 9: 実機で通しで確認する

ローカルの Supabase と dev サーバーを立てて、ブラウザで編集・削除を通す。Vitest では検証できない箇所（Popover と Sheet の重なり、シートの history 制御、RLS が本当に効くか、削除後の戻り先）を見る。

**Files:**
- なし（確認のみ）

**Interfaces:**
- Consumes: Task 1〜8 のすべて
- Produces: なし

- [ ] **Step 1: `verify` スキルの手順で環境を立てる**

Run: このリポジトリの `verify` スキルを呼ぶ（Supabase ローカル + Vite dev + Playwright MCP の起動手順が入っている）

Expected: `http://127.0.0.1:3000` が開き、Google ログインが通る

- [ ] **Step 2: 編集を通す**

1. 適当な章から自分の投稿を1件作る
2. フィードでその投稿をタップして詳細へ入る
3. ヘッダー右の「…」→「編集」
4. シートのタイトルが「投稿を編集」、本文が初期表示され、聖典参照がチップ（selector ではない）になっていること
5. 何も変えない状態で「更新する」が押せないこと
6. 本文を変えて「更新する」→ シートが閉じ、本文が更新され、日時の横に「編集済み」が出ること

- [ ] **Step 3: 公開範囲の変更を確認する**

1. 同じ投稿を編集し、公開範囲を「自分のみ」にして更新
2. ブラウザのシークレットウィンドウで同じ URL を開き、404 になること

- [ ] **Step 4: 章ページ経由の削除を確認する**

1. 章ページを開き、節バブルから自分の投稿の節コメントシートを開く
2. 投稿をタップして詳細へ入る
3. 「…」→「削除」→「削除する」
4. トーストが出て**章ページに戻り**（フィードではない）、その投稿が節から消えていること

- [ ] **Step 5: 直リンクからの削除を確認する**

1. 新しいタブに投稿詳細の URL を直接貼って開く
2. 「…」→「削除」→「削除する」
3. フィード（`/`）へ送られること

- [ ] **Step 6: 他人の投稿にメニューが出ないことを確認する**

別アカウントの投稿の詳細を開き、ヘッダーに「…」が無いこと

- [ ] **Step 7: 確認結果を記録する**

通らなかった項目があれば、修正して該当タスクのテストを追加する。すべて通ったらこのタスクは完了。コミットは不要（コード変更が無ければ）
