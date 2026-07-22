# 聖典しおり（栞）機能 設計

- 日付: 2026-07-22
- ステータス: 設計承認済み・実装計画待ち

## 背景・目的

聖典を読んでいる途中で離脱しても、また同じ場所に戻ってこられるようにしたい。「栞」機能として次の2つの体験を提供する。

1. **続きを読む（自動）**: 聖典の章ページを開くたびに、その位置を自動的に「最後に読んだ場所」として記録する。ユーザーは何も操作しない。
2. **栞一覧（手動）**: ユーザーが明示的にボタンを押して、任意の章に栞を挟む・外す。複数保持できる。

対象は章単位（節単位の栞は対象外、[Out of Scope](#out-of-scope) 参照）。

## 保存方式: localStorage（zustand persist）

Supabase のテーブルではなく、`zustand` の `persist` ミドルウェアで `localStorage` に保存する（`features/select-verse-view` の `selectedUserStore` と同じパターン）。

**この選択によるトレードオフ（了承済み）:**

- 端末・ブラウザをまたいで栞は同期されない
- シークレットモードやブラウザストレージのクリアで消える
- 一方でメリットとして、DB マイグレーション・RLS が不要になり、**ログインしていないユーザーでも聖典を読みながら栞を使える**（`/scriptures/*` は元々未ログインで閲覧可能なため、この整合性が取れる）

## データモデル

```ts
export type ScriptureLocation = {
  collection: string
  book: string
  chapter: number
}

export type Bookmark = ScriptureLocation & {
  id: string          // crypto.randomUUID()
  createdAt: string   // ISO 8601
}
```

ストア状態:

```ts
type BookmarkState = {
  readingPosition: ScriptureLocation | null
  bookmarks: Bookmark[]  // 新しい順（先頭が最新）
  setReadingPosition: (loc: ScriptureLocation) => void
  toggleBookmark: (loc: ScriptureLocation) => void  // 既存なら削除、なければ先頭に追加
  removeBookmark: (id: string) => void
}
```

`toggleBookmark` の同一性判定は `collection`/`book`/`chapter` の完全一致で行う（同じ章への重複登録を防ぐ）。

## FSD 配置

### `entities/bookmark`（新規）

状態管理層。型定義とストア、SSR セーフな読み取り用フックを公開する。

```
entities/bookmark/
  model/
    bookmarkStore.ts   # useBookmarkStore（zustand + persist）
  index.ts
```

`index.ts` で公開する API:

- `type ScriptureLocation`, `type Bookmark`
- `useBookmarkStore`（アクション呼び出し用: `setReadingPosition` / `toggleBookmark` / `removeBookmark`）
- `useReadingPosition(): ScriptureLocation | null` — SSR/初回クライアントレンダーは `null` を返し、マウント後に永続化された値を反映する（`useSelectedUserId` と同じ `useMounted` ガード）
- `useIsBookmarked(loc: ScriptureLocation): boolean` — 同上のマウントガード付き
- `useBookmarks(): Bookmark[]` — 同上のマウントガード付き（マウント前は `[]`）

localStorage キーは `manna:bookmarks:v1`。

### `features/toggle-bookmark`（新規）

```
features/toggle-bookmark/
  ui/
    BookmarkButton.tsx
  index.ts
```

`BookmarkButton` は `entities/bookmark` の `useIsBookmarked` と `toggleBookmark` を使う薄いUIラッパー。

Props: `{ loc: ScriptureLocation }`

表示: アイコンのみのボタン（`lucide-react` の `Bookmark` / `BookmarkCheck` を状態に応じて出し分け）、`variant="ghost"` 相当、`aria-label` は「栞に追加」/「栞から削除」を状態で切り替える。ログイン状態に関わらず常に活性。

### `pages/bookmarks/`（新規）

`pages/posts/new` を置き換える形で新設。認証不要（localStorage ベースのため）。

## 章ページ（`$chapter.tsx`）への組み込み

- `ChapterPage` コンポーネント直下（`ChapterView`/`VerseView` どちらのモードでも）で、表示中の `{ collection, book: book.id, chapter }` を `setReadingPosition` に渡す `useEffect` を追加する。章が変わるたびに上書きされる。
- `ChapterView` と `VerseView` それぞれのヘッダー `action` に、既存の `ComposeMenu` / `ComposeButton`（投稿ボタン、ログイン時のみ表示）と横並びで `BookmarkButton` を常時表示する（`flex items-center gap-2` でラップ）。

## `pages/bookmarks/` の UI

### セクション1: 続きを読む

- `readingPosition` が存在する場合: カード表示。`getScriptureLabel`（`entities/scripture`）でラベルを生成し、タップでその章（`/scriptures/$collection/$book/$chapter`）へ遷移。
- 存在しない場合（栞機能を使い始めてまだ聖典を開いていない）: 空状態「聖典を読むとここに続きが表示されます」＋ `/scriptures` へのリンク。

### セクション2: 栞一覧

- 見出し「栞一覧」（既存の「この章への投稿」などと同じ `text-xs font-medium` スタイル）
- `bookmarks` が空でない場合: 新しい順にリスト表示。各行は章ラベル（`getScriptureLabel`）＋ `formatDate(createdAt)`（`shared/lib/date`、`PostCard` と同じ関数）。タップで該当章へ遷移、行末に削除ボタン（塗りつぶし `Bookmark` アイコン、タップで即座に `removeBookmark`。確認ダイアログなし — ローカル操作でやり直しが効くため）。
- 空の場合: 既存の `EmptyState` コンポーネントで「栞はまだありません。聖典を読んでいるときに 🔖 をタップすると追加されます。」

## ナビゲーション変更

- `shared/config/navigation.ts`: `{ to: '/posts/new', label: '投稿する', ... }` を `{ to: '/bookmarks', label: '栞', Icon: Bookmark }` に差し替える。
- `pages/__root.tsx` の `AUTH_REQUIRED_PREFIXES` から `/posts/new` を削除する（`/bookmarks` は追加しない＝認証不要ページ）。
- `pages/posts/new.tsx` と対応するテストを削除する。
  - `widgets/post-editor` は `widgets/post-composer-sheet` からも使われているため削除しない。
  - `/posts/new` への参照は `navigation.ts` / `__root.tsx` / `posts/new.tsx` 自身のみであることを確認済み（他ページからのリンクなし）。

## テスト方針

TDD で進める（失敗テスト → 実装 → 通過）。

- `tests/entities/bookmark/bookmarkStore.test.ts`: `setReadingPosition` の上書き、`toggleBookmark` の追加/削除、重複防止、`removeBookmark`、新しい順の並び。`tests/features/select-verse-view/selectedUserStore.test.ts` を参考にする。
- `tests/features/toggle-bookmark/BookmarkButton.test.tsx`: 未栞状態でクリック→アイコン切り替え、栞済み状態でクリック→解除。`tests/features/follow-user/FollowButton.test.tsx` を参考にする。
- `tests/pages/bookmarks/index.test.tsx`: 続きを読むカードの表示/空状態、栞一覧の表示/空状態、削除操作。
- 章ページ側のテスト（既存の `tests/pages/scriptures/...` があれば）に、`BookmarkButton` が表示されること・訪問時に `readingPosition` が更新されることのケースを追加。

## 削除対象ファイル

- `apps/pwa/src/pages/posts/new.tsx`
- 対応するテストファイル（`apps/pwa/tests/pages/posts/new.test.tsx` 等、存在すれば）

## Out of Scope

- 節単位の栞（章単位のみ）
- コレクションごとに複数の「続きを読む」位置を保持すること（全体で1つのみ）
- 複数端末・ブラウザ間の栞の同期
- 栞の並び替え・フォルダ分けなどの整理機能
