# 章コメント一覧「誰が」ビュー再設計

**作成日:** 2026-07-19
**対象:** Manna PWA（Phase 1 継続改善）
**関連 PR:** [#48](https://github.com/dashi296/manna/pull/48) — 元の「節ごとアバタースタック」実装。本設計はこれの後継案。

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

## デスクトップ右レール

新規 `widgets/chapter-comment-rail/ui/ChapterCommentRail.tsx`:

- `useIsMobile === false` かつ `selectedUser !== null` かつ `selectedUserPosts.length > 0` で描画
- レイアウト: 節本文コンテナと flex 横並び。レール幅 `320px`（幅制約に応じて可変、最小 `240px`）
- ページ全体スクロール（右レール単独の scroll pane にはしない — 節との視覚整列が保てる）
- レール内は各コメントを `PostCard` 互換の縮小カード（`compact` variant）で並べ、`created_at` 降順
- 各カード上部: `📖 節N` の小見出しリンク（節ページ遷移）
- 節本文コンテナ側にも `●` マーカー（選択ユーザーが投稿した節に）: 位置合わせのアフォーダンス

## モバイル Sheet

新規 `widgets/chapter-comment-rail/ui/VerseCommentSheet.tsx`:

- `useIsMobile === true` かつ `selectedUser !== null` の時、節右に `👤` ミニアバターマーカー
- マーカータップ → 下から `Sheet`（既存 `@/shared/ui/sheet` プリミティブ）
- Sheet 中身: その節に対する選択ユーザーの投稿を新着順で全件（複数あればスクロール）
- Sheet ヘッダー: `📖 第N章 節M — 中村さん`
- Sheet 内フッター: `プロフィールを見る →`（プロフィール遷移）

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
| `widgets/chapter-comment-rail/ui/ChapterCommentRail.tsx` | 新規 | デスクトップ右レール |
| `widgets/chapter-comment-rail/ui/VerseCommentSheet.tsx` | 新規 | モバイル Sheet |
| `widgets/chapter-comment-rail/index.ts` | 新規 | Public API |
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
| モバイル画面をローテートしてデスクトップ幅になった / 逆 | `useIsMobile` の再評価で右レール↔マーカー Sheet 表示が切り替わる（既存パターンと同じ） |
| `?view=who&user=xxx&mode=select` の同時指定 | 選択モード優先（既存の `SelectionModeHeader` に置き換わる）。マーカーと右レールも隠す |

## テスト

Vitest + @testing-library/react:

- `parseSelectedUser`: 正規表現マッチ / 型ガード / 未定義処理
- `ChapterCommentersRow`: 空状態、選択済み表示、`onSelect` コールバック、`解除` 挙動
- `ChapterCommentRail`（デスクトップ）: `selectedUserPosts` の描画、空配列で `null`、compact カード表示
- `VerseCommentSheet`（モバイル）: マーカー描画、Sheet トリガー、複数コメントスクロール
- `VerseRow`: `commenterMarker` プロップの描画とマーカー無しの互換動作
- `pages/scriptures/*/$chapter`（既存拡張）: `?view=who&user=xxx` パス時に loader が期待通りの `selectedUserPosts` を返す、`user` 未指定・不正時のフォールバック

## リリース手順

1. 本 spec → 実装計画 → PR で完結
2. `?view=who` 経路のみ影響。既存 `view=count` の挙動は完全保持
3. マージ後、Chrome / iOS Safari 実機で verify skill 実行

## 未確定事項（実装前に確認したい）

- **PR #48 との関係**: 本 PR がマージされる場合、PR #48（元の「節ごとアバタースタック」）はどう扱うか？
  - a) 本 PR で置き換え、PR #48 はクローズ
  - b) PR #48 を先にマージし、本 PR は差分実装
  - c) 両方保持して段階リリース
- **`chapter-comment-rail` の widget 配置**: 右レールとモバイル Sheet を同一 widget に置くか、レール widget + Sheet widget で分けるか。単一 widget で `useIsMobile` により内部分岐する方が呼び出し側が単純
- **右レール中カードの `PostCard` compact variant**: 既存 `PostCard` を拡張するか、新規 `CompactPostCard` を作るか
- **削除する localStorage**: `WhoFilterSheet` を廃止する際、既存ユーザーの localStorage キー `manna:verseWhoFilter:v1` は放置か明示的にクリアか
