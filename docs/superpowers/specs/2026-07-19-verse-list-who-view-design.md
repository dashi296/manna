# 節一覧「誰が投稿しているか」ビュー 設計

**作成日:** 2026-07-19
**対象:** Manna PWA（Phase 1 継続改善）

## 背景と目的

現在の章画面 (`/scriptures/:collection/:book/:chapter`) の節一覧では、各節の右側に「N件」という投稿数バッジのみが表示される。ユーザーからは「どの節に誰が反応しているのか」がひと目で分からず、家族やフォロー相手が読み進めている箇所を追いかけたい、というニーズに応えられない。

そこで章画面にビュー切替 (`件数 / 誰が`) を追加し、「誰が」モードでは各節に **自分のサークル**（自分 ∪ フォロー中 ∪ 家族関係 accepted）で投稿しているユーザーのアバターを重ねて表示する。加えて、そのサークル内で「誰を表示するか」を個別マルチセレクトで絞り込めるようにし、家族の特定メンバーだけを追う、といった使い方を可能にする。

## スコープ外（YAGNI）

- 節タップで投稿者一覧をモーダル表示する導線（別 issue 化候補）
- 「家族のみ／フォローのみ」といったプリセット絞り込みショートカット
- 章横断のグローバルなアクティビティタイムライン
- サークル外ユーザー（例: パブリック投稿の一般ユーザー）の可視化
- 節タップで直接プロファイル遷移する等の副次導線

## 用語

- **サークル**: 自分自身、`follows` 上でフォロー中のユーザー、`family_relationships` の status='accepted' で自分と結ばれているユーザー、の和集合
- **表示対象**: サークルから、ユーザーが後述のフィルタで **チェックを入れた** ユーザーだけを取り出した集合。フィルタ未設定時は「サークル全員」が既定

## 全体像

3 層構成:

| 層 | 追加物 | 役割 |
|---|---|---|
| features | `features/select-verse-view/` | ビュー切替 (`count / who`) のセグメントと、表示対象フィルタ用シート |
| shared | `shared/ui/AvatarStack.tsx` | 節行に重ね表示するアバタースタック（+N 対応、他画面でも再利用） |
| entities | `entities/user/lib/getCircleUserIds.ts` | サーバー内でサークル ID 集合を取り出すユーティリティ |

既存 `features/select-scripture-verses/ui/VerseRow.tsx` に描画モードプロップを追加し、章 loader (`pages/scriptures/$collection/$book/$chapter.tsx`) からデータを供給する。

## URL / state

`ChapterSearch` に 1 パラメータを追加:

- `view?: 'who'` — 存在すれば `who`、無ければ `count` として扱う（デフォルトを URL に載せない方針）

`view=who` の URL は共有可能。ただし表示対象フィルタは URL に載せず、`localStorage` に永続化する（次節参照）。

## 表示対象フィルタ

`localStorage` キー: `manna:verseWhoFilter:v1`

保存形式:

```json
{ "excluded": ["user-id-a", "user-id-b"] }
```

- **exclude リストで持つ**理由: サークルは follow/family の追加で増える。既定は「サークル全員 ON」であってほしいので、明示的に外したユーザーだけを保存する。新しくフォローした人が勝手に「表示ゼロ」に落ちない
- **`v1` サフィックス**: 将来の形式変更に備える
- SSR では読み取れないため、初回描画時は「全員表示」の想定 markup を出し、ハイドレーション後にクライアントで補正。`view=who` 自体は URL にあるので行の骨格（節番号・本文・アバター領域確保）は SSR で確定する

### フィルタ UI

- 章ヘッダー右のセグメントコントロール `件数 / 誰が` の右横に、フィルタボタン（`Users` アイコン）を配置。**`view=who` かつログイン済み** の時だけ出す
- ボタンを押すと下からシート (`Sheet`) が開き、サークル全員がリスト表示される
  - 各行: アバター + 表示名 + チェックボックス（既定 ON）
  - 上部に「すべて選択 / すべて解除」のショートカット
  - サークルが空なら「フォロー中／家族の投稿がここに表示されます」の空状態
- シートを閉じたタイミングで `localStorage` に保存し、章 loader の再取得は行わず、クライアント側で `avatarsByVerse` を再フィルタして即反映

## 章ヘッダーの UI

現状:

```
[戻る] 第N章  ...  [本文] [ComposeMenu]
```

追加後（ログイン済み時）:

```
[戻る] 第N章  ...  [本文] [件数|誰が] [👥フィルタ]? [ComposeMenu]
```

- セグメントコントロールは `role="radiogroup"`、内部 2 ボタンは `role="radio" aria-checked`
- `[👥フィルタ]` は `view=who` の時のみ表示
- 未ログイン時は `[件数|誰が]` セグメント自体を出さない（既存の `件数` 表示のみ）
- ヘッダー右側が横に長くなりすぎるため、選択モード (`mode=select`) 中は既存通り `SelectionModeHeader` に置き換わり、ビュー切替は隠れる

## 節行の見た目

`view=who` モード時の `VerseRow`:

- 右端の「N件」バッジを **AvatarStack** に差し替え
  - 最大 3 個までアバターを重ね表示、超過分は `+N` の丸バッジ
  - 並び順: そのユーザーの **最新投稿 `created_at` 降順**（ユーザー単位で dedup）
  - サークル内の投稿者が 0 のとき: バッジ自体を出さない（節本文＋Chevron のみ）
- `mode='select'`（節選択モード）中は既存の左端チェック UI と併存。ただし章ヘッダーがセレクションヘッダーに置き換わるため、`view=who` は `mode='read'` の時にだけ有効

### AvatarStack

`shared/ui/AvatarStack.tsx`:

```typescript
type AvatarStackItem = { userId: string; name: string; avatarUrl: string | null }
type Props = {
  items: AvatarStackItem[]
  max?: number // default 3
  size?: number // default 20 (px)
  ariaLabel?: string
}
```

- 各アバターは 20px 円、`ring-1` で背景色との縁取り
- 3 個超過時、末尾に `+N` の丸バッジ（同径、`--chip-bg` / `--palm` を使用）
- 全体は `role="group"` + `aria-label`（例: `2件の投稿 中村さん・田中さん`）

## サーバー側データ

章 loader は今のところ `fetchChapterData` と `fetchVerseData`（節絞り込み時）に分かれている。`view=who` 変更は **章ビュー** のみに影響し、節絞り込みビュー (`?verses=...`) は既存動作のまま。

### 変更点: `fetchChapterData` の分岐

```typescript
// pseudo-code
if (view === 'who' && userId) {
  const circleIds = await getCircleUserIds(supabase, userId)  // [self, ...follows, ...family]
  const { data: versePosts } = await supabase
    .from('posts')
    .select('user_id, users!posts_user_id_fkey(display_name, avatar_url), scripture_verses, created_at')
    .eq('scripture_collection', collection)
    .eq('scripture_book', book)
    .eq('scripture_chapter', chapter)
    .not('scripture_verses', 'is', null)
    .in('user_id', circleIds)
    .order('created_at', { ascending: false })

  // 節 -> [{userId, name, avatarUrl, createdAt}]
  const avatarsByVerse = groupByVerseDedupUser(versePosts)
  return { posts, countByVerse: {}, avatarsByVerse, circleUsers, verseTexts, userId, view: 'who' }
}
// 既存パス（view=count 相当）
return { posts, countByVerse, avatarsByVerse: {}, circleUsers: [], verseTexts, userId, view: 'count' }
```

- `circleUsers`: サークル全員の `{userId, name, avatarUrl}`。フィルタシートで一覧表示するため、`view=who` のときだけ返す
- RLS が visibility を強制するため、アプリ側の visibility フィルタは不要

### `getCircleUserIds`

`entities/user/lib/getCircleUserIds.ts`（`user` エンティティ新設）:

```typescript
export async function getCircleUserIds(
  supabase: SupabaseServer,
  userId: string,
): Promise<{ ids: string[]; users: UserSummary[] }> {
  const [{ data: follows }, { data: family }] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', userId),
    supabase
      .from('family_relationships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
  ])
  const ids = new Set<string>([userId])
  follows?.forEach((f) => ids.add(f.following_id))
  family?.forEach((r) => {
    ids.add(r.requester_id === userId ? r.addressee_id : r.requester_id)
  })
  const idList = [...ids]
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, avatar_url')
    .in('id', idList)
  return { ids: idList, users: (users ?? []) as UserSummary[] }
}
```

## FSD 配置まとめ

| パス | 追加/変更 | 内容 |
|---|---|---|
| `entities/user/lib/getCircleUserIds.ts` | 新規 | サーバー用サークル取得 |
| `entities/user/index.ts` | 新規 | パブリック API |
| `features/select-verse-view/model/viewMode.ts` | 新規 | `parseViewMode`, `serializeViewMode`, `type VerseViewMode` |
| `features/select-verse-view/model/useWhoFilter.ts` | 新規 | localStorage 永続化フック（`excluded` 集合の読み書き） |
| `features/select-verse-view/ui/ViewModeToggle.tsx` | 新規 | セグメントコントロール |
| `features/select-verse-view/ui/WhoFilterSheet.tsx` | 新規 | チェックボックスシート |
| `features/select-verse-view/index.ts` | 新規 | パブリック API |
| `shared/ui/AvatarStack.tsx` | 新規 | アバタースタック |
| `shared/ui/index.ts` | 変更 | AvatarStack 追加 export |
| `features/select-scripture-verses/ui/VerseRow.tsx` | 変更 | `view: 'count' \| 'who'` と `avatars?: AvatarStackItem[]` プロップ追加 |
| `pages/scriptures/$collection/$book/$chapter.tsx` | 変更 | `view` パース、`fetchChapterData` 分岐、ViewModeToggle / WhoFilterSheet 統合 |

インポートルールは既存の FSD ルールに従う（features → entities → shared のみ）。

## エッジケース

| ケース | 挙動 |
|---|---|
| 未ログインで `?view=who` を踏む | 章 loader で `view = 'count'` に強制フォールバック。URL の `view` パラメータは残るがセグメントは出さない |
| サークルが空（フォローも家族も 0） | セグメントは操作可能。フィルタシートは空状態を表示。節一覧は全節でアバター 0 |
| サークル全員をフィルタでチェック外し | 節一覧は全節でアバター 0（意図した挙動）。フィルタボタンにドット等の「絞り込み中」インジケータ |
| `view=who` かつ節絞り込み `?verses=1,2` の同時指定 | 節絞り込みビュー (`VerseView`) に入るので `view` は今回無視される。設計は章ビュー限定 |
| localStorage が読めない環境（プライベートモード等） | try/catch でフォールバック。既定「全員表示」で運用 |
| フォロー/家族の追加直後 | サーバー loader は毎回サークルを再計算するので次のナビゲーションで自動反映 |

## テスト

Vitest + @testing-library/react（`tests/` 配下）:

- `shared/ui/AvatarStack`: 3 件超過で `+N` になる、`items` の順序が保たれる、`aria-label` が付く
- `features/select-verse-view/model/viewMode`: `parseViewMode` の妥当性検証（`'who' | undefined` のみ受け付ける）
- `features/select-verse-view/model/useWhoFilter`: 初期状態は「全員 ON」、外したユーザー ID が localStorage に載る、`v1` キーで読める
- `features/select-verse-view/ui/ViewModeToggle`: `radiogroup` / `radio` ロールがある、`onChange` が URL 変更を呼ぶ
- `features/select-scripture-verses/ui/VerseRow`: `view='who'` かつ `avatars=[]` で `+N` バッジも件数バッジも出ない、`view='who'` かつ `avatars` ありでスタックが描画される
- `pages/scriptures/*/$chapter`（既存があれば拡張）: `view=who` パス時にモックした Supabase 応答から avatarsByVerse が期待通り

## リリース手順（推奨）

1. spec → 実装計画 → PR（本 issue で完結）
2. 実装計画に沿って PR を作成し、Vitest / lint / build を通過させる
3. マージ後、Chrome / iOS Safari 実機で動作を確認する（手順は `verify` skill を利用可）

## オープンな確認事項

- 「サークル」を **自分 ∪ フォロー中 ∪ 家族 accepted** の **和集合** と定義しています（ブレスト中のやり取りで集合演算記号のズレがあったため念のため明記）。もし「和集合ではなく、家族かつフォローしている人 (**積集合**) だけを対象にしたい」という意図であれば、`getCircleUserIds` のロジックだけ差し替えれば良い
- アバタースタック最大表示数は 3 個で仮置き。実装時にモバイル幅で試して調整する（`AvatarStack` の `max` プロップで簡単に変更可能）
