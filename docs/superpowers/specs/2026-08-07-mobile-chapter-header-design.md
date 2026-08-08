# モバイル章ページヘッダーの整理 設計

- 日付: 2026-08-07
- ステータス: 実装完了（ブランチ mobile-chapter-header）

## 背景・目的

聖典の章ページ（`apps/pwa/src/pages/scriptures/$collection/$book/$chapter.tsx`）のヘッダーが、モバイル幅で横方向に混雑している。

現状、375px 幅の1行に以下が並ぶ:

| 要素 | 必要幅の目安 |
|---|---|
| `‹ 第1ニーファイ書`（戻る） | 約 110px |
| `第1ニーファイ書 第1章`（タイトル） | 約 150px |
| `✏️投稿` ピル | 約 60px |
| `🌐` 二言語トグル | 32px |
| `🔖` 栞 | 32px |

左右パディング 32px と gap を足すと 400px を超え、`PageHeader` のタイトルが `truncate` で潰れる。

最大の冗長は**書名の二重表示**である。`backLabel` が `book.name`、`title` が `${book.name} 第N章` を返すため、「第1ニーファイ書」が横に2回並ぶ（`$chapter.tsx:492-494`、`shared/lib/scriptureUtils.ts:33`）。

本設計はこの横方向の混雑のみを対象とする。ヘッダーの縦の厚み（コメンター行の積み重ね）は対象外。

## 方針の前提

利用頻度のヒアリング結果として、**読書中に頻繁に押されるのは二言語トグルと栞**であり、投稿は主目的ではあるが押す頻度は低い。したがって「主要アクションをヘッダーに残す」という一般的な定石は適用せず、頻用の2アイコンをヘッダーに残し、投稿を FAB へ退避する。

### 採用しなかった案

- **投稿ボタンをアイコンのみにする**: 節約は約 30px に留まり、タイトル潰れが解消しない。またアイコンが3つ並ぶため主要操作の見分けがつかない。
- **2段ヘッダー（パンくず型）**: 横は完全に解決するが縦が約 40px 増える。コメンター行と合わせて本文開始位置が大きく下がり、読書体験を損なう。

## 変更後のレイアウト

```
┌───────────────────────────────────┐
│ ‹ 第1ニーファイ書   第1章      🌐  🔖 │
├───────────────────────────────────┤
│ 😀 😀 😀 😀                          │
├───────────────────────────────────┤
│ 1 わたしニーファイは善い両親から…     │
│                                     │
│                          ╭──────╮ │
│                          │ ✏️投稿 │ ← FAB
│                          ╰──────╯ │
├───────────────────────────────────┤
│  🏠    📖    🔖    🔔    👤          │
└───────────────────────────────────┘
```

## 設計

### 1. タイトルから書名を落とす

章ビューのタイトルを `第${chapter}章` に変更する。書名は戻るリンクが担うため情報は失われない。

`getScriptureLabel` は投稿カードなど他の箇所でも使われるため**共通関数は変更しない**。章ページ側で分岐する。

序文・扉ページ（`book.isFrontMatter`）は元々 `title` が書名、`backLabel` がコレクション名で重複していないため現状維持とする。

デスクトップとモバイルで出し分けはしない。デスクトップも左レールと戻るリンクに書名の文脈があり、分岐を持ち込むだけの利得がない。

### 2. 節ビューのタイトルから絵文字を落とす

節ビュー（`?verses=...` 付きの表示）のタイトル先頭にある `📖` を削除する（`$chapter.tsx:318`）。

節ビューは `title` が `第1ニーファイ書 1:1`、`backLabel` が `第1章` で書名の重複はないが、絵文字と「投稿する」テキストボタンにより章ビューより横幅が厳しい。章ビューと節ビューは同じ URL を search param で行き来するため、ヘッダーの作りを揃える。

### 3. 投稿を FAB へ移す

`ComposeMenu`（`widgets/compose-menu`）に省略可能な `layout?: 'pill' | 'fab'` prop を追加する（デフォルト `'pill'`）。`layout` だけが pill（ポップオーバー）と fab（ボトムシート）を決め、`ComposeMenu` 自身はビューポートを見ない。見た目は共通の `ComposePostButton`（`shared/ui/ComposePostButton.tsx`）が `layout` prop で FAB とピルを切り替える。呼び出し側（`ChapterView` / `VerseView`）が配置場所と `layout` を同時に決める。

どちらを見せるかは CSS のブレークポイントが決める。呼び出し側が両方を常にマウントし、`className` で `hidden lg:inline-flex`（ヘッダー内ピル）と `lg:hidden`（FAB）を渡す。`ComposeMenu` は受け取った `className` をトリガーへ転送する。`lg` は `useIsMobile()` の `MOBILE_BREAKPOINT`（1024px）と同じ境界。

- モバイル: 右下固定の円形 FAB。`fixed right-4 bottom-[calc(var(--bottom-nav-h)+1rem)]`
- デスクトップ: ヘッダー内のピルのまま。横幅に余裕があり FAB を出す理由がない
- タップ領域 56px、`aria-label="投稿する"`
- 節選択モード中は FAB を隠す。`SelectionModeHeader` が「N節に投稿」を持っており二重になるため

`--bottom-nav-h` は `styles.css:89` に既存の CSS 変数で、`__root.tsx:102` と `InstallPwaBanner.tsx:73` が既に使っている。

当初は `useIsMobile()` による JS 分岐で実装したが、このフックは初回レンダーで必ず `false` を返すため、モバイルではハイドレーション後にピルから FAB へ切り替わるレイアウトシフトが起きた（issue #111）。上記の CSS 方式に変更してこれを解消した。

両方を常にマウントするため `open` state はピル用と FAB 用で別々になる。トリガーはブレークポイントの class で隠れるが、**開いている Sheet / Popover は portal に描画されるため class が届かない**。メニューを開いたまま境界をまたぐと非表示側のメニューだけが取り残される（ボトムシートの場合は `body` のスクロールロックも残る）。そのため `ComposeMenu` は `matchMedia` で `MOBILE_BREAKPOINT` の跨ぎを監視し、またいだ時点で自分の `open` を閉じる。境界をまたがないリサイズでは発火しないため、通常の開閉には影響しない。

### 4. FAB が開く先は章ビューと節ビューで異なる

FAB の見た目は共通コンポーネントとして共有するが、押したときの挙動は2つに分かれる。

| 画面 | FAB が開くもの |
|---|---|
| 章ビュー | `ComposeMenu`（「章全体に投稿」「節を選んで投稿」の2択） |
| 節ビュー | `PostComposerSheet` を直接開く |

節ビューには節選択モードが存在せず（`enterSelectMode` は `ChapterView` 側の関数）、対象の節は既に URL で確定している。したがって2択を挟む意味がなく、現行の `ComposeButton` と同じく composer を直接開く。

### 5. ローカル `ComposeButton` の削除

`$chapter.tsx:252` にローカル定義されている `ComposeButton` は、FAB の見た目コンポーネントに置き換わるため削除する。

### 6. `InstallPwaBanner` との重なり

`InstallPwaBanner` は `bottom-[var(--bottom-nav-h)] z-40 lg:hidden` の全幅バナーで、FAB と同じ領域を占める。

当初はこの重なりを「バナーは一時的な表示だから許容する」と判断したが、コードレビューで**視覚的に隠れるだけでなくタップも奪われる**ことが判明した。バナーの内側バーは不透明な `bg-background` を持ち、モバイル幅では画面いっぱいに広がって FAB の下側約60%を覆う。さらに外側の全幅ラッパーが `lg` 未満の全ビューポートでポインタイベントを受け取るため、その領域のタップは FAB ではなくバナーに当たる。バナーを見るユーザー層にとって投稿導線が事実上到達不能になるため、許容できない。

対応として、バナーが自身の実測高さを `--install-banner-h` という CSS 変数で公開し、FAB がそれを足した位置に配置される。

- バナー側: `ResizeObserver` で内側バーの `offsetHeight` を測り `document.documentElement` に設定する。非表示なら `0px`
- FAB 側: `bottom-[calc(var(--bottom-nav-h)+var(--install-banner-h)+1rem)]`
- 併せてラッパーに `pointer-events-none`、内側バーに `pointer-events-auto` を付け、バナーの左右の透明領域がタップを奪わないようにする

高さを定数で持たずに実測するのは、バナーの内容（文言の折り返しなど）で高さが変わったときに FAB の位置が自動で追随するようにするため。

### FAB の下に隠れるコンテンツの回避

FAB の位置だけを上げると、本文側の下余白が固定値のままになり、バナー表示中は最下部のカードが移動後の FAB に隠れる。リンクを持つ `PostCard` では操作不能になる。

そのため余白も `--fab-clearance` として一箇所で定義し、FAB を出す2画面（`VerseView` の投稿リストと `ChapterView` の `verseList`）がこれを参照する。

```css
--fab-clearance: calc(6rem + var(--install-banner-h));
```

`6rem` は FAB の高さ 3.5rem（`h-14`）＋下オフセット 1rem＋余裕。FAB のサイズや位置を変えるときはこの値も合わせる。

## テスト方針

CLAUDE.md の TDD に従い、失敗テストから書く。

| ファイル | 検証内容 |
|---|---|
| `tests/pages/scriptures/chapter.test.tsx` | 通常の書でタイトルが `第1章`、戻るラベルが書名であること |
| `tests/pages/scriptures/chapter.test.tsx` | 序文（`isFrontMatter`）では従来どおり書名がタイトルであること |
| `tests/pages/scriptures/chapter.test.tsx` | 節ビューのタイトルに `📖` が含まれないこと |
| `tests/pages/scriptures/chapter.test.tsx` | FAB がヘッダー外で `lg:hidden`、ピルがヘッダー内で `hidden lg:inline-flex` を持つこと。節選択モード中は FAB を出さないこと |
| `tests/pages/scriptures/chapter.test.tsx` | 章ビューの FAB は2択メニューを開き、節ビューの FAB は composer を直接開くこと |
| `tests/widgets/compose-menu/ComposeMenu.test.tsx` | `layout` だけで pill／fab が決まりビューポートに依存しないこと。`className` をトリガーへ転送すること |
| `tests/shared/ui/PageHeader.test.tsx` | 変更なし（`PageHeader` 自体は変更せず props の渡し方のみ変わるため） |

FAB の位置は CSS のみで決まりテストで検証しづらいため、テストでは**存在・非存在と `aria-label`** に絞る。見た目と重なりは実機確認に回す。

## 影響範囲

| ファイル | 変更内容 |
|---|---|
| `pages/scriptures/$collection/$book/$chapter.tsx` | タイトル分岐、`📖` 削除、FAB 配置、`ComposeButton` 削除 |
| `widgets/compose-menu/ui/ComposeMenu.tsx` | `layout?: 'pill' \| 'fab'` prop を追加し、`useIsMobile()` と合わせて FAB/ピルを JS で出し分け |
| `shared/ui/PageHeader.tsx` | 変更なし |
| `shared/lib/scriptureUtils.ts` | 変更なし |
