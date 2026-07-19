# 章コメント一覧「誰が」ビュー再設計

**作成日:** 2026-07-19
**対象:** Manna PWA（Phase 1 継続改善）
**関連 PR:** [#48](https://github.com/dashi296/manna/pull/48) — 元の「節ごとアバタースタック」実装。**本設計で置き換え、PR #48 は close する。**

## 背景と目的

PR #48（issue #47）で章画面に `件数 / 誰が` セグメント切替を実装した。「誰が」モードでは各節右にサークル内投稿者のアバタースタックが並び、シートで表示ユーザーを絞り込める。

ただし実利用を想定すると次の課題が残る:

1. **章全体の会話を追いにくい** — 節ごとにアバターが散在するため、「特定の人がこの章にどう反応しているか」を俯瞰しにくい
2. **深掘りの動線がない** — アバターは投稿者を示すだけで、そこから本文を読むには節ページに遷移するしかない
3. **フィルタ UI がクリック数を増やす** — マルチセレクトのシートを開いて絞り込む工程が重い

そこで「章にコメントしている人をヘッダーで俯瞰 → 1 人を選んでその声を並走読み」というインタラクションに再設計する。

## スコープ外（YAGNI）

- サークル外（無関係な他ユーザー）のアバター表示
- 章横断のアクティビティタイムライン
- 選択ユーザーへの DM やリアクション
- 複数ユーザー同時比較（アバター多重選択）

## 全体像

```
章画面（?view=who&user=<id>）:
┌─ ヘッダー ───────────────────────────────────────┐
│ 第N章  [本文] [件数|誰が] [👥👥👥👥👥]  [投稿] │
│                    ↑ サークル内でこの章に投稿している人   │
└─────────────────────────────────────────────────┘

  デスクトップ:                       モバイル:
  ┌─────────────┬───────────┐        ┌────────────────┐
  │ 節1 本文    │           │        │ 節1 本文       │
  │ 節2 本文 ●  │ コメ 節2  │        │ 節2 本文 👤    │ ← タップで
  │ 節3 本文    │           │        │ 節3 本文       │   Sheet
  │ 節4 本文 ●  │ コメ 節4  │        │ 節4 本文 👤    │
  └─────────────┴───────────┘        └────────────────┘
```

## 用語

- **サークル**: 自分自身 ∪ フォロー中 ∪ 家族 accepted（既存 `getCircleUserIds` の返り値）
- **章コメンター**: サークル内で「この章の節に投稿がある人」の集合。ヘッダーのアバター列に出す対象
- **選択ユーザー**: URL パラメータ `user` で指定される 1 人。この人のコメントだけを表示

## URL / state

`ChapterSearch` に 1 パラメータ追加:

- `view?: 'who'` — 既存
- `user?: string` — 選択ユーザー ID

`user` は `view === 'who'` の時だけ意味を持つ。それ以外の状況では無視。バリデーション:
- 型 `string` かつ長さ制限（UUID 想定、正規表現 `/^[0-9a-f-]{8,36}$/i`）
- サーバー loader 側で「サークル内 & この章に投稿がある」ことを確認できなかった場合は `null` として扱う（サイレントに解除）

`view=count` は URL に載せない方針を継続。`user` も未選択なら載せない。

## 章コメンター行（ヘッダー）

新規 `features/select-verse-view/ui/ChapterCommentersRow.tsx`:

```
[👥👥[中村]👥👥→]  [解除]?
```

- サークル内でこの章に投稿があるユーザーのみ表示
- **並び順**: 最終投稿 `created_at` 降順（最近発言した人が左）
- 横スクロール可能（4 人以上は overflow-x）
- 各アバター: `24px` 円、クリックで `patchSearch({ user: id })`
- 選択済みユーザーはリング + 明示的な `解除` ボタン（アバターの右）
- `view === 'who'` かつ `canCompose === true` かつ `chapterCommenters.length > 0` の時のみ描画

### 空状態

- 章コメンターがゼロの場合: アバター列自体を出さない。ヘルパー文言「フォロー中／家族のこの章への投稿はまだありません」を薄く表示

## デスクトップ: 節ごとの吹き出し

**Note (2026-07-19 更新):** 当初は `widgets/chapter-comment-rail` によるデスクトップ右レールを予定していたが、実機検証で `root layout` の `max-w-md` 制約下では成立しづらく、また Codex review でも「rail が本文を覆う」P2 が指摘されたため、**節ごとに直接吹き出し (`CommenterBubble`) を並べる形**に方針転換。

新規 `entities/post/ui/CommenterBubble.tsx`:

- `useIsMobile === false` かつ `selectedUser !== null` の場合、選択ユーザーがコメントしている節の右に吹き出しを表示
- 内容は選択ユーザーの `CompactPostCard`（既存の縮小カード）を吹き出しラッパーで囲む
- 節の左端を指す tail（三角形）付き、背景 `--chip-bg`、`--chip-line` の細ボーダー
- 複数コメントは吹き出しを縦にスタック（会話風）、`created_at` 降順

節リスト構造は以下に変更:

```
<ul>
  {verses.map(verse => (
    <li>
      <div className="lg:flex lg:gap-4">
        <VerseRow ... className="lg:flex-1" />
        {selectedUser && postsByVerse.has(verse) && (
          <div className="hidden lg:flex flex-col gap-2 lg:w-72">
            {postsByVerse.get(verse).map(p => (
              <CommenterBubble key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </li>
  ))}
</ul>
```

### root layout の `max-w-md` 制約

現行 `apps/pwa/src/pages/__root.tsx` は全ページを `max-w-md mx-auto` (448px) で包む。節本文 + 吹き出しを横並びにするには、章画面ではこの制約を緩める必要がある。

**方針**: `useRouterState` で pathname を取得し、`/scriptures/[collection]/[book]/[chapter]` (`[chapter]` は数字) にマッチする時だけ `max-w-md` を外して `lg:max-w-4xl`（896px）程度に拡張。他ページの見た目には影響しない。

## モバイル Sheet

新規 widget `widgets/verse-comment-sheet/` — モバイル専用:

- `useIsMobile === true` かつ `selectedUser !== null` の時、節右に `👤` ミニアバターマーカー
- マーカータップ → 下から `Sheet`（既存 `@/shared/ui/sheet` プリミティブ）
- Sheet 中身: その節に対する選択ユーザーの投稿を新着順で全件。カードは `CompactPostCard`
- **Codex P2 対応**: `Sheet` 内側に `max-h-[70vh]` + `overflow-y-auto` を追加し、多件時にスクロール可能にする
- Sheet ヘッダー: `📖 節N — 中村さん`

## CompactPostCard

既存 `entities/post/ui/CompactPostCard.tsx`（PR #50 で導入済み）:

- `PostCard` と同等の情報を持つ縮小版（アバター xs、パディング詰め、`created_at` 相対表示）
- **デスクトップの吹き出し内**（`CommenterBubble` の子）と**モバイルの Sheet 内**の両方で使う
- コンテンツ本文は 3 行 clamp、投稿ページへの Link
- Link `aria-label` は `${displayName}: ${content}` 形式で作者情報を保持

## サーバー / データ

`fetchChapterData` を拡張。既存の 4 並列に加え:

1. **章コメンター取得**: 「サークル内かつこの章に節投稿がある」人の情報
   - サブクエリ: `posts` を `scripture_collection/book/chapter` フィルタ + `.not('scripture_verses', 'is', null)` + `.in('user_id', circle.ids)` で `user_id, created_at` を取得
   - dedup: `user_id` 単位でグループ化、`max(created_at)` を保持
   - `AvatarStackItem[]` を最終投稿降順で返す
2. **選択ユーザーの節投稿**: `user` パラメータがある場合のみ
   - `posts` を `POST_SELECT` + `user_id = selectedUser` + 章フィルタ + `.not('scripture_verses', 'is', null)` + `created_at desc`
   - `versesWithSelectedUser: Set<number>`（マーカー描画用に節番号を抽出）

これらは同じ `posts` テーブルへの 2 クエリ。可能なら 1 クエリで両方導出できる（circle 内全投稿を取得し、選択ユーザー分は絞り込みでフィルタ）。実装時に判断する。

loader 戻り値の追加:
- `chapterCommenters: AvatarStackItem[]`
- `selectedUser: AvatarStackItem | null`（URL の user が有効な場合）
- `selectedUserPosts: PostWithUser[]`
- `versesWithSelectedUser: Set<number>`

## FSD 配置

| パス | 追加/変更 | 内容 |
|---|---|---|
| `features/select-verse-view/ui/ChapterCommentersRow.tsx` | 新規 | ヘッダーのアバター行 |
| `features/select-verse-view/model/parseSelectedUser.ts` | 新規 | URL パラメータ validation |
| `features/select-verse-view/index.ts` | 変更 | 上記 export、`WhoFilterSheet` / `useWhoFilter` は不要になるので削除 |
| `widgets/chapter-comment-rail/` | **削除** | デスクトップ右レール（吹き出し方式に置換） |
| `entities/post/ui/CommenterBubble.tsx` | 新規 | 選択ユーザーの吹き出し（`CompactPostCard` を包む） |
| `entities/post/index.ts` | 変更 | `CommenterBubble` を追加 export |
| `widgets/verse-comment-sheet/ui/VerseCommentSheet.tsx` | 変更 | `max-h-[70vh]` + `overflow-y-auto` を追加 |
| `pages/__root.tsx` | 変更 | 章画面ルートのみ `max-w-md` を `lg:max-w-4xl` に緩和 |
| `features/select-scripture-verses/ui/VerseRow.tsx` | 変更 | `commenterMarker?: AvatarStackItem` プロップ追加（節右の `●`/`👤` マーカー）。従来の `view: 'who' + avatars` は削除 |
| `pages/scriptures/$collection/$book/$chapter.tsx` | 変更 | loader 拡張、`ChapterCommentersRow` / `ChapterCommentRail` / `VerseCommentSheet` を統合 |
| `shared/ui/AvatarStack.tsx` | 既存維持 | ヘッダーの avatar overflow などに引き続き利用可（ただし節ごとには使わない） |

## エッジケース

| ケース | 挙動 |
|---|---|
| 未ログインで `?view=who&user=xxx` を踏む | 章コメンター行もマーカーも出さない。`view=count` として振る舞う |
| サークルは持っているが章コメンターがゼロ | 章コメンター行は非表示。案内文言を薄く表示 |
| `user` パラメータが無効（サークル外 / この章に投稿なし / 不正形式） | サーバー loader で `selectedUser = null` に強制。URL に載っていても UI 上は解除状態 |
| 選択ユーザーの投稿を削除した直後 | 次のナビゲーションで loader が再取得、自動的に解除される |
| モバイル画面をローテートしてデスクトップ幅になった / 逆 | `useIsMobile` の再評価で吹き出し↔マーカー Sheet 表示が切り替わる（既存パターンと同じ） |
| `?view=who&user=xxx&mode=select` の同時指定 | 選択モード優先（既存の `SelectionModeHeader` に置き換わる）。マーカー・吹き出しも隠す |
| 同節に選択ユーザーの投稿が多数（>5件）ある場合 | デスクトップは吹き出しが縦に伸びる（各節が縦に大きくなる）。モバイル Sheet は `max-h-[70vh]` で内部スクロール |

## テスト

Vitest + @testing-library/react:

- `parseSelectedUser`: 正規表現マッチ / 型ガード / 未定義処理（PR #50 で導入済み）
- `ChapterCommentersRow`: 空状態、選択済み表示、`onSelect` コールバック、`解除` 挙動（PR #50 で導入済み）
- `CommenterBubble`: `post` プロップの描画、tail 装飾、CompactPostCard の内包
- `VerseCommentSheet`: `max-h-[70vh]` + `overflow-y-auto` が適用されている（新規 test case）
- `VerseRow`: `commenterMarker` プロップの描画とマーカー無しの互換動作（PR #50 で導入済み）
- `pages/scriptures/*/$chapter`: 節リストで `postsByVerse` から吹き出しが描画される、`useIsMobile` の false 時のみ吹き出しが出る
- `pages/__root.tsx`: chapter 画面で `max-w-md` が外れて広い幅になる

## リリース手順

1. 本 spec → 実装計画 → PR で完結
2. `?view=who` 経路のみ影響。既存 `view=count` の挙動は完全保持
3. マージ後、Chrome / iOS Safari 実機で verify skill 実行

## 決定済みの設計判断

前バージョンで未確定だった 4 点、次のように決定:

- **PR #48 との関係**: **本 PR で置き換え、PR #48 は close**。#48 で作った下層実装 (`getCircleUserIds`, `AvatarStack`, `ViewModeToggle` 等) は本 PR で作り直す
- **widget 配置**: **`widgets/chapter-comment-rail`（デスクトップ）と `widgets/verse-comment-sheet`（モバイル）の 2 つに分割**。呼び出し側で `useIsMobile` により表示先を選ぶ。各 widget は自身のターゲットサイズを意識しない
- **コメントカード**: **新規 `shared/ui/CompactPostCard`** を作る。`PostCard` の compact variant ではなく別コンポーネント（右レール・Sheet 固有の視覚要件が既存カードと離れているため）
- **localStorage `manna:verseWhoFilter:v1`**: **放置**。取り除きコードは書かない。少量のデッドキーが残るが実害なし

## 設計 pivot 履歴 (2026-07-19)

PR #50 は最初「デスクトップ右レール + モバイル Sheet」構成で実装した (commit `2c9504d` まで)。実機動作で以下 2 点が判明:

1. **root layout の `max-w-md` 制約と rail の衝突**: `fixed` positioning で回避したが、Codex review で「rail が本文を覆う」問題が P2 指摘
2. **モバイル Sheet が多件時にスクロールできない**: Codex review P2 指摘

これを受けて 2026-07-19 に「節ごとの吹き出し (`CommenterBubble`) + `max-w-md` 緩和 + Sheet スクロール」構成に pivot。実装は PR #50 の追加コミットで対応。
