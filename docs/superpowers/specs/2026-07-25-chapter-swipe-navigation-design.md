# 章画面のスワイプナビゲーション 設計

- 日付: 2026-07-25
- ステータス: 設計承認済み・実装計画待ち

## 背景・目的

モバイルで聖典の章を読んでいるとき、次章/前章に移動するには「戻る」→書一覧/章一覧→次の章、という手数がかかる。読書体験を連続的にするため、章表示画面（`ChapterView`）でのスワイプ操作による章間ナビゲーションを追加する。

- 左スワイプ → 次の章
- 右スワイプ → 前の章

（写真送り・ページめくり系アプリの一般的な慣習に合わせた方向。実機検証を経て当初案の左右を入れ替えている）

## スコープ

- 対象画面: `apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx` の `ChapterView`（章全体表示）のみ
- `VerseView`（特定の節のみを表示する画面）は対象外
- `mode === 'select'`（節選択モード）では無効化
- 有効化条件: 既存の `useIsMobile`（1024px未満、`@/shared/hooks/use-mobile`）が `true` のときのみ

### 移動範囲

- 書（book）の境界をまたいで移動する（例: 第1ニーファイ書22章 → 第2ニーファイ書1章）
- 前付け文書（`book.isFrontMatter === true` の書。タイトルページ・序文・三人の証人の証・八人の証人の証・預言者ジョセフ・スミスの証）はスワイプ移動先の対象から常にスキップする
- コレクション（モルモン書・旧約聖書など）の境界は越えない。コレクションの先頭/末尾では移動先なし

## アーキテクチャ

### 1. `entities/scripture` — 章参照の計算ロジック

`apps/pwa/src/entities/scripture/lib/scriptureNavigation.ts` に純粋関数を追加する:

```typescript
type ChapterRef = { collection: string; book: string; chapter: number }

export function getAdjacentChapterRef(
  current: ChapterRef,
  direction: 'next' | 'prev',
): ChapterRef | null
```

ロジック:

1. 現在の書の章数（`book.chapters`）に収まる範囲なら、同じ書の `chapter ± 1` を返す
2. 書の境界（`next` で最終章、`prev` で1章目）に達したら、同じコレクション内で `book.isFrontMatter` の書を読み飛ばしながら次/前の書を探す
   - 見つかった書の `next` なら1章目、`prev` なら最終章（`book.chapters`）を返す
   - コレクションの先頭/末尾まで前付け文書以外の書が見つからなければ `null`
3. `entities/scripture/index.ts` から `getAdjacentChapterRef` をエクスポートする

このロジックはReact/DOMに依存しない純粋関数として実装し、単体テストで境界条件を網羅する。

### 2. `features/swipe-chapter-navigation` — ジェスチャーとナビゲーション

新規 feature スライスを作成する。

```
features/swipe-chapter-navigation/
  lib/useChapterSwipe.ts   -- ポインタイベント処理・ドラッグ状態・しきい値判定
  ui/SwipeableChapterView.tsx -- ラッパーコンポーネント（children を包む）
  index.ts                  -- SwipeableChapterView を公開
```

**`useChapterSwipe` フック**は以下を担当する:

- `onPointerDown/Move/Up/Cancel` でドラッグの `deltaX` を追跡
- 現在位置 `loc: ChapterRef` と `direction`（`deltaX` の符号から決定）に対して `getAdjacentChapterRef` を呼び、移動先の有無を判定
- 移動先が無い方向へのドラッグは `deltaX` を0に固定（追従させない）
- ポインタリリース時、`|deltaX|` がコンテナ幅の20%を超えていれば、該当方向へ100%スライドアウトするアニメーション（約200ms ease-out）の後、TanStack Router の `navigate` で移動先の章へ遷移
- 20%未満なら0へスプリングバック（約200ms ease-out）
- `loc`（`collection`/`book`/`chapter`）が変化したら `deltaX` を即座に0にリセット（新しい章のコンテンツがオフセット済みで表示されるのを防ぐ）
- `disabled` プロパティ（`mode === 'select'` のときに渡す）で全ハンドラを無効化

**`SwipeableChapterView` コンポーネント**:

- `children` を `transform: translateX(deltaX)` を適用した `div` でラップ
- ラッパーに `touch-action: pan-y` を指定し、縦スクロールとの競合を回避する（`preventDefault` は使わない）
- ドラッグ中のみ `transition: none`、リリース後のアニメーション中は `transition: transform 200ms ease-out`

### 3. `ChapterView` での組み込み

`$chapter.tsx` の `ChapterView` 内、`posts` 表示 + `verseList` をこのラッパーで包む。`chapterHeader`（PageHeaderや投稿者アバター行）はラップの外に置き、スワイプ中も固定表示のままにする。

```tsx
<SwipeableChapterView loc={loc} disabled={mode === 'select'}>
  {posts.length > 0 && ( ... )}
  {verseList}
</SwipeableChapterView>
```

## エラーハンドリング / エッジケース

- 移動先なし（コレクション境界）: ドラッグしても追従しない（何も起きない）。しきい値判定も発生しない
- 前付け文書自体を表示中でも、フック自体は動作する（例: タイトルページから左スワイプすると前付け文書をすべて読み飛ばして最初の実書1章へ）
- ナビゲーション後のデータ取得は既存の TanStack Router の `loader` に委譲する（プリフェッチ等の追加最適化は本設計のスコープ外）
- マルチタッチ（2本指以上）は考慮しない（最初のポインタのみ追跡）

## テスト計画

- `tests/entities/scripture/scriptureNavigation.test.ts`
  - 章内移動（前後とも）
  - 書またぎ（最終章→次の書1章目、1章目→前の書最終章）
  - 前付け文書のスキップ（前方・後方とも、複数連続してスキップするケースを含む）
  - コレクション先頭/末尾で `null`
  - 章数1の書（前付け文書以外、例: エノス書）の前後移動
- `tests/features/swipe-chapter-navigation/SwipeableChapterView.test.tsx`
  - しきい値を超えるドラッグで正しい移動先へ `navigate` が呼ばれる
  - しきい値未満のドラッグでは `navigate` が呼ばれない
  - `disabled` のときは一切反応しない
  - 移動先がない方向のドラッグでは `navigate` が呼ばれない

## Out of Scope

- `VerseView` へのスワイプ対応
- コレクション境界を越える移動
- 前付け文書自体へのスワイプ到達（常にスキップ）
- ドラッグ中に隣の章のプレビューを表示する（今回はスライドアウト後に遷移するのみ）
