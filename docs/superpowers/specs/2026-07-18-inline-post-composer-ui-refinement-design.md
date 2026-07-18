# インライン投稿コンポーザー UI 再考 設計

**作成日:** 2026-07-18
**対象:** Manna PWA（`feat/inline-post-composer` ブランチ上の UI 改善）
**元設計:** [`2026-07-18-inline-post-composer-design.md`](2026-07-18-inline-post-composer-design.md)（機能設計。データフロー・下書き・シート挙動などは踏襲）

## 背景

元設計で「聖典を読みながら投稿する」インライン導線を実装したが、実機・スクリーンショット確認で以下の UX 課題が見えてきた。

- **章ビューの視覚ノイズ**: 全節にチェックボックスが常時表示され、「読む体験」と「選ぶ体験」のモードが混在している
- **アフォーダンス不足**: 「節をタップして詳細を見る・チェックで複数選択して投稿できます」の長い説明文は、UI 単体で伝えきれていない証拠
- **ヘッダーのボタン過多**: 「本文↗」「章に投稿」の 2 つが並び、狭いモバイル幅で情報量が多い
- **下部フローティングバーの情報密度**: デスクトップでは右下に小さくピル化し、ラベル `1節選択中: 1` が冗長 / 多数選択時は `他 k 件` で潰れる
- **節行の 2 系統タップ領域**: チェックボックスと本文リンクが同居し、どちらをタップすべきか迷う

## 目標

- 章ビュー初期状態を**クリーンな読書画面**にする
- 「読む → 選ぶ → 書く」の状態遷移を**明示的なモード切替**で表現する
- 投稿導線を**単一のエントリポイント**（ヘッダー右の「投稿」ボタン）に集約する
- 下書き保存・シート内挙動・URL 同期などの**機能設計は元設計を踏襲**する

## 非目標（今回変更しない）

- `PostComposerSheet` の内部レイアウト（節チップ・タブ・textarea・公開範囲・送信ボタン）
- `PostEditor` の `mode='sheet' | 'page'` 分岐
- 下書き保存のキー設計（節ごとに分離）
- 節ビュー（`?verses=N`）の基本レイアウト（節本文表示 → 投稿一覧の順序）
- `/posts/new` 直リンク画面

## 全体像

章ビューに **`mode: 'read' | 'select'`** の状態を導入する。

- **`read` モード（初期）**: 節リストはチェックボックス無しのクリーンな見た目。ヘッダー右に「投稿」ボタン 1 つ。
- **`select` モード**: ヘッダーが選択専用ヘッダーに置き換わり、各節行にチェックボックスがフェードインする。行全体タップで選択トグル。

`read` から `select` への遷移は「投稿」ボタンのメニューから明示的に選ぶ。

## 章ビュー（`read` モード）

### ヘッダー

```
[< 書名]  {書名} 第{n}章                 [本文↗]  [投稿 ✏️]
```

- `[本文↗]`: 公式サイトへの外部リンク（現状踏襲）
- `[投稿 ✏️]`: **単一のエントリポイント**。未ログイン時は非表示
- 既存の「章に投稿」独立ボタンは廃止し、下記メニュー内項目に統合

### ヘッダー下の説明文

- 「節をタップして詳細を見る・チェックで複数選択して投稿できます」は**削除**
- 節末の `→` 記号（もしくは行全体がリンクである視覚）でアフォーダンスを表現

### 節リスト

- 各行: `{節番号}  {本文}  {件数バッジ}  {→}`
- チェックボックスは**表示しない**
- 行全体タップで節ビューへ遷移（現状踏襲）
- 件数バッジ（`3件`）は現状踏襲

## 投稿ボタンのメニュー

「投稿」ボタンタップで開く。

**モバイル**（`useIsMobile() === true`）:
- 下から出る `Sheet`（`side='bottom'`、`h='auto'`）
- 各項目は高さ 56px 以上のタップ領域

**デスクトップ**:
- Base UI の `Popover`、ボタン直下にアンカー
- 幅 220–240px

**項目**:

1. 📖 **章全体に投稿** — `PostComposerSheet` を即起動、`initialScripture = { collection, book, chapter, verses: undefined }`
2. ✏️ **節を選んで投稿** — `select` モードへ遷移

**閉じる**: 項目タップ / メニュー外タップ / Esc

## 章ビュー（`select` モード）

### ヘッダー

`PageHeader` を **`SelectionModeHeader`** で置き換える:

```
[✕ キャンセル]      {n}節選択中      [投稿 (n)]
```

- モバイル幅では中央ラベルを `{n}節選択中` のみに省略
- デスクトップ幅では右側に先頭 3 節のプレビュー `1, 2, 3…` を副次表示（幅に余裕があれば）
- `n === 0` のとき: 中央ラベル `節を選んでください`、`投稿 (0)` は **disabled**
- `[✕ キャンセル]` タップで `read` モードに戻る（選択破棄）
- `[投稿 (n)]` タップで `PostComposerSheet` 起動、`initialScripture.verses = 選択配列`

### 節リストの視覚変化

`read` → `select` の遷移で 200–250ms のトランジション:

- 各行左端に **円形チェック**（未選択: `border` のみ / 選択: `background + Check` アイコン）がフェードイン + 左からスライド
- 行末の `→` 記号（詳細ビュー導線）はフェードアウト
- 選択された行の左に **3px の縦アクセントバー**、行背景に `var(--chip-bg)` の淡色
- 節末の件数バッジ（`3件`）は残す（選択判断の材料）

**タップ挙動**:

- 行全体（節番号 + 本文含む）タップで**選択トグル**
- 節詳細ビューへの遷移は **`select` モード中は無効**
- チェックボックスは視覚のみ（独立したタップ領域を持たない → タップ領域の分断を避ける）

### モード終了

- **キャンセル**: `read` モードへ、`?select` と `?mode` をクリア
- **投稿完了**: シート閉じ後、`read` モードへ自動復帰、`?select` と `?mode` をクリア、`router.invalidate()` で件数バッジ更新
- **ブラウザバック / Esc**: キャンセルと同等（`history.pushState` でモード遷移時に history エントリを追加）

## URL 同期

現状の `?select=1,2,3` に加えて `?mode=select` を追加する。

- `?mode=select` 単体: `select` モード（未選択状態）で開く。リロード時にモード復帰
- `?mode=select&select=1,2,3`: 選択済みでモード復帰
- `?mode` は `'select'` のみ許容。他の値は無視して `read` モード
- `read` モードのとき URL に `?mode` / `?select` は載らない

## 節ビュー（`?verses=N`）

**変更なし**（元設計の踏襲）:

- ヘッダー右に **「投稿する」1 ボタン**（メニュー無し、タップで即シート起動）
- 節が確定しているため選択モードは持たない

## 廃止するコンポーネント / 記述

- **`features/select-scripture-verses/ui/SelectionBar.tsx`** — 削除
- **`features/select-scripture-verses/ui/VerseCheckbox.tsx`** — 削除（新しいチェック表示は行内に統合）
- 章ビュー内の「節をタップして詳細を見る・チェックで複数選択して投稿できます」テキスト — 削除
- 章ビューヘッダー右の「章に投稿」独立ボタン — 削除（メニュー項目に統合）

## 新規 / 改修コンポーネント

### 新規

**`features/select-scripture-verses/ui/SelectionModeHeader.tsx`**
- Props: `count: number` / `preview?: number[]` / `onCancel: () => void` / `onSubmit: () => void`
- モバイル/デスクトップ幅で中央ラベルの粒度を切り替え
- `count === 0` で送信 disabled

**`features/select-scripture-verses/ui/VerseRow.tsx`**
- Props: `verse: number` / `textHtml?: string` / `count: number` / `mode: 'read' | 'select'` / `selected: boolean` / `onSelect: () => void` / `linkProps`
- `mode='read'`: 現状の Link 行と等価な見た目
- `mode='select'`: 左にチェック表示、行全体タップで `onSelect`、`→` 非表示
- 現状の `pages/scriptures/$collection/$book/$chapter.tsx` に散在するインライン JSX から切り出す

**`widgets/compose-menu/ui/ComposeMenu.tsx`**
- Props: `trigger: ReactNode` / `onSelectChapter: () => void` / `onSelectVerses: () => void`
- モバイルでは Sheet、デスクトップでは Popover に自動分岐
- `useIsMobile` で切り替え

### 改修

**`features/select-scripture-verses/model/useVerseSelection.ts`**
- 戻り値に `mode: 'read' | 'select'` を追加
- API: `{ selection, mode, enterSelect(), exitSelect(), toggle(v), clear() }`
- 内部で `?select` と `?mode` を URL search param に同期

**`pages/scriptures/$collection/$book/$chapter.tsx`**
- `validateSearch` に `mode?: 'select'` を追加
- 章ビュー: `useVerseSelection` の `mode` に応じて `PageHeader` / `SelectionModeHeader` を切り替え
- 節リスト行を `VerseRow` に置換
- ヘッダー右の「投稿」ボタンは `ComposeMenu` でラップ

**`widgets/post-composer-sheet/ui/PostComposerSheet.tsx`**
- 変更なし

**`widgets/post-editor/ui/PostEditor.tsx`**
- 変更なし

## アニメーション

- `read` ↔ `select` 遷移: 200–250ms
- チェック表示: 左からスライドイン + フェード、`transform: translateX(-8px → 0)` + `opacity: 0 → 1`
- 行末 `→`: フェードアウトのみ
- 選択済み行のアクセントバー: `opacity: 0 → 1`（`translate` なし）
- `prefers-reduced-motion` を尊重（遷移なし、状態変化のみ）

## 認証・エラー

**未ログイン時**:
- ヘッダー右の「投稿」ボタンは**非表示**（現状はボタン自体を出さない実装なので踏襲）
- `?mode=select` を URL に直接指定してアクセスした場合はモードを無視し `read` として扱う（未ログインで選択モードに入っても投稿できない）

**シート内エラー**: 現状踏襲（シート閉じない、赤字エラー表示）

## テスト方針

Vitest + @testing-library/react。既存テストの差分は次のとおり:

### 削除

- `tests/features/select-scripture-verses/SelectionBar.test.tsx` — コンポーネント廃止に伴い削除
- `tests/features/select-scripture-verses/VerseCheckbox.test.tsx` — コンポーネント廃止に伴い削除

### 新規

**`tests/features/select-scripture-verses/SelectionModeHeader.test.tsx`**
- `count=0` で「節を選んでください」表示、送信ボタン disabled
- `count=3` で「3節選択中」表示、送信ボタン有効
- キャンセルクリックで `onCancel` 呼び出し
- 送信クリックで `onSubmit` 呼び出し

**`tests/features/select-scripture-verses/VerseRow.test.tsx`**
- `mode='read'`: リンクとして機能、チェック表示無し
- `mode='select'`: 行タップで `onSelect` 呼び出し、リンク遷移が発生しない
- `mode='select'` かつ `selected=true`: チェックが埋まった見た目、アクセントバー表示

**`tests/widgets/compose-menu/ComposeMenu.test.tsx`**
- 「章全体に投稿」で `onSelectChapter` 呼び出し
- 「節を選んで投稿」で `onSelectVerses` 呼び出し
- Esc / 外側クリックでメニューが閉じる

### 拡張

**`tests/features/select-scripture-verses/verseSelection.test.ts`**
- `enterSelect()` で URL に `?mode=select` が付く
- `exitSelect()` で `?mode` と `?select` の両方が消える
- `?mode=select&select=1,2` を読んで `mode='select'`, `selection=[1,2]` を返す
- `?mode=invalid` は `mode='read'` にフォールバック

### 手動検証（`verify` skill）

- 章ビューで「投稿」→「章全体に投稿」で節指定なしのシートが開く
- 章ビューで「投稿」→「節を選んで投稿」で選択モードに入り、複数節を選んで投稿できる
- 選択モードでキャンセル → クリーンな読書ビューに戻る
- 選択モード中の URL リロードで状態が復元される
- ブラウザバックで選択モードから抜ける

## 主要な設計判断

**なぜモード切替を明示的にするか**

現状の「常時チェックボックス表示」は、読書中のユーザーの視野に選択 UI が常に入り込む。SNS として「読んで感動 → 書く」の流れを最適化するなら、**書く意図が生まれた瞬間だけ選択 UI が出る**方が集中を邪魔しない。iOS Mail・Photos・Files などの主要アプリが採用する「編集/選択モード」パターンと同型で学習コストが低い。

**なぜ投稿ボタンを 1 つに集約するか**

「章に投稿」と「複数節を選ぶ」が並ぶと、初見ユーザーは違いを理解するために 2 つのラベルを読み比べる必要がある。1 つのボタンに集約してメニューで意図を選ばせる方が、認知負荷が低く、モバイル狭幅のヘッダーもすっきりする。

**なぜ選択済みフローティングバーを廃止するか**

選択モードのヘッダーに `n節選択中 [投稿(n)]` があるため、下部バーは機能的に冗長。フローティング要素を減らすことで背景の聖典本文への視線集中が保たれる。

**なぜ選択モード中に節詳細ビュー導線を無効化するか**

「読む → 選ぶ → 書く」の直線的な導線を保つため。詳細ビューへの分岐が残ると、選択中にうっかりタップして状態が失われるリスクがある。詳細ビューは `read` モードで見てから選択モードに入る、または投稿後に見る、という順序で整理する。

**なぜチェックボックスを独立タップ領域にしないか**

現状は「本文タップは詳細ビュー / チェックボックスタップは選択」の 2 系統。指の大きさに対してチェックボックスは 20px と小さく、誤タップが起きやすい。行全体を選択トグルにすれば、タップ精度に依存せず、モード中の期待動作も一貫する。
