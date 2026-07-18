# インライン投稿コンポーザー設計

**作成日:** 2026-07-18
**対象:** Manna PWA（Phase 1 完了後の UX 改善）
**関連:** [`2026-06-28-post-creation-design.md`](2026-06-28-post-creation-design.md)（現行の `/posts/new` 画面）

## 背景と課題

現状、投稿導線は次のようになっている:

1. `/scriptures/:c/:b/:ch?verses=N`（節ビュー）で「投稿する」ボタンをタップ
2. `/posts/new?collection=...&book=...&chapter=...&verses=...` にページ遷移
3. 遷移先では聖典本文が消え、`ScriptureSelector` で節を再確認しながら投稿を書く

**問題:**

- 感動の一次資料である聖典本文が、書いている最中に見えない
- 節参照を「読みながら決めた」のに、投稿画面で再選択が発生する二重操作
- 複数節（例: モーサヤ 3:19–21）にまたがる感想を書くには、節ビュー→投稿画面→再選択という遠回りが必要
- 投稿完了で `/`（ホーム）に強制遷移するため、続けて別の節への投稿がしづらい

**目標:**

- 聖典本文が視野に入ったまま投稿を書けるようにする
- 節の選択を「読みながら」できるようにする（章ビュー上でのマルチ選択）
- 投稿完了後は聖典画面に留まり、続きの読書・投稿へスムーズに戻れるようにする

## 全体像

読書画面（章ビュー・節ビュー）から**ボトムシート**として投稿エディタを起動する。既存の `/posts/new` ページは互換のため残す。

- 節ビュー: 「投稿する」ボタン → シートを開く（`initialScripture = { collection, book, chapter, verses }`）
- 章ビュー: 節リストの各行にチェックボックスを設け、複数節を選択 → 画面下部の「選択済みバー」から「投稿」ボタン → シート起動
- 章全体への投稿（節指定なし）: 章ビューヘッダー右の「章に投稿」ボタン → シート起動

## 画面遷移

### 節ビュー（`/scriptures/:c/:b/:ch?verses=N`）

- ヘッダー右の「投稿する」を **Link → Button** に変更し、Base UI の `Sheet` のトリガーに差し替える
- URL は変わらない。シートを開くとき `history.pushState` で history エントリを 1 つ追加し、`popstate` でシートを閉じる（Android の戻るボタン・ブラウザバックに対応）
- 投稿成功: シートを閉じ、`router.invalidate()` で loader を再実行して投稿カードを反映
- 投稿失敗: シートは閉じない。textarea 上部に赤字エラーを表示し、`submitting` を戻す

### 章ビュー（`/scriptures/:c/:b/:ch`）

- 節リストの各行の左端に丸チェックボックスを常時表示（未選択時はアウトラインのみ、選択時は塗り）
- 行本体（節番号 + 本文）タップは従来通り節ビューへ遷移。チェックボックス領域だけタップイベントを分離
- 1 節以上選択されると、画面下部（`BottomNav` の直上）に **選択済みバー** がスライドイン
- ヘッダー右の「本文を読む」外部リンクは残しつつ、その左に「章に投稿」ボタンを追加

**選択済みバーの表示:**

- `{n}節選択中: {v1}, {v2}, {v3}（他 k 件）` の形式（先頭 3 件 + 他件数）
- 右側に `[クリア]` `[投稿✏️]` ボタン
- 選択 0 件で非表示

**選択状態の URL 同期:**

- URL search params `?select=1,2,3` に同期（リロード・戻る操作に耐性）
- 章ページ内での選択のみ有効。章を離れると URL から自動的に消える
- 不正値（範囲外・非数値）はパース時に無視して残りを採用

### `/posts/new`（直リンク）

- 変更なし。既存の下書き互換のため残す
- 将来的にホーム FAB を「聖典を開く→書く」フローに置き換える可能性があるが本設計のスコープ外

## コンポーネント構成（FSD）

### 新規

**`widgets/post-composer-sheet/`** — シート UI 本体
- `ui/PostComposerSheet.tsx`
  - Props: `open: boolean` / `onOpenChange: (v: boolean) => void` / `initialScripture?: ScriptureRefPartial`
  - 内部で `Sheet`（Base UI Dialog ベース）と `PostEditor`（`mode='sheet'`）を組み合わせる
- `index.ts`

**`features/select-scripture-verses/`** — 章ビューでの節マルチ選択
- `ui/VerseCheckbox.tsx` — 各節行に付ける丸チェックボックス
- `ui/SelectionBar.tsx` — 下部フローティングバー
- `model/useVerseSelection.ts` — URL search param `?select=` と同期するフック
- `index.ts`

### 改修

**`widgets/post-editor/ui/PostEditor.tsx`**
- 新規 Props:
  ```ts
  type Props = {
    initialScripture?: ScriptureRefPartial
    mode?: 'page' | 'sheet'  // default: 'page'
    onSuccess?: () => void
  }
  ```
- `mode='sheet'` のとき、外側の `p-4` パディングを削り、シート側のパディングに委譲
- 投稿成功時、`onSuccess` があればそれを呼ぶ（なければ現行通り `navigate({ to: '/' })`）
- 下書きキーを節ごとに分離（後述）

**`pages/scriptures/$collection/$book/$chapter.tsx`**
- 節ビュー: `Link` → `PostComposerSheet` トリガーボタンに差し替え
- 章ビュー:
  - `validateSearch` に `select?: number[]` を追加
  - `useVerseSelection` を呼び出して選択状態を管理
  - 節リスト行を `VerseCheckbox + Link` の複合構造に変更
  - ページ末尾に `SelectionBar` を配置
  - ヘッダー右に「章に投稿」ボタン（節ゼロで起動）を追加

**`pages/posts/new.tsx`** — 変更なし

## シート UI 詳細

**レイアウト（モバイル基準・360dp 幅想定）:**

```
┌─────────────────────────────────┐
│ ──                              │ ← ドラッグハンドル
│ 📖 モーサヤ 3:19–21    [✕]     │ ← ヘッダー
├─────────────────────────────────┤
│ [19] [20] [21] [+節]            │ ← 節チップ（追加/削除）
├─────────────────────────────────┤
│ [編集] [プレビュー]              │ ← TabBar
│ ┌─────────────────────────────┐ │
│ │ 感じたことを書いてください… │ │ ← textarea
│ └─────────────────────────────┘ │
│                                 │
│ 公開範囲: [公開▼]                │
│                                 │
│              [投稿]              │
└─────────────────────────────────┘
```

- シート高さ: 初期 `70dvh`、上端ドラッグで最大 `92dvh`、下端ドラッグで閉じる
- 節本文はシート内に**表示しない**（背後の聖典画面で見えるため冗長）
- 節チップの `[+節]` で `ScriptureSelector` の節ピッカーを再利用
- キーボード追従: `viewport-fit=cover` + `<meta name="viewport" content="interactive-widget=resizes-content">` を index.html に追加
- Base UI Dialog の `modal` 挙動により、シート外領域のスクロールとタップは無効化

## 下書き保存

現状は `localStorage['manna:post-draft']` に単一のグローバル下書きを保存している。これを**節ごとに分離**する。

**キー設計:**

```
manna:post-draft:${collection}:${book}:${chapter}:${verses.sort((a,b)=>a-b).join(',')}
```

- 節指定なし（章全体投稿）は末尾が空: `manna:post-draft:bofm:mosiah:3:`
- 節参照なし投稿（`ScriptureSelector` で何も選ばない）は特殊キー `manna:post-draft:none`
- 節が異なれば別下書き扱い。同じ節に戻れば復元される

**移行:**

- `/posts/new` 直リンクは既存グローバルキー `manna:post-draft` を引き続き使用（後方互換）
- 既存下書きの自動移行はしない（Phase 1 の実運用が短いため）

**削除タイミング:**

- 投稿成功時、該当キーのみ削除
- 明示的な「破棄」ボタンは今回作らない（シートを閉じるだけでは削除しない）

## 投稿完了後の挙動

- シートを閉じる
- 節ビューにいる場合: `router.invalidate()` で loader 再実行 → 投稿カードが先頭に追加される
- 章ビューにいる場合: 同上（章ビューの `countByVerse` も更新される）
- `sonner` の Toast で「投稿しました」を表示
- URL は変えない（ホームにリダイレクトしない）

## 認証・エラー

**未ログイン時:**

- シートのトリガーボタンをクリック → シートは開かず `/login?redirect=<現在URL>` に遷移
- 章ビューで節選択済みなら、redirect 先の URL に `?select=...` が含まれるので復帰可能

**Supabase insert 失敗:**

- シートは閉じない
- textarea 上部に赤字エラー表示（「投稿に失敗しました。もう一度お試しください。」）
- `submitting = false` に戻し、再送信可能にする

**ネットワーク切断:**

- ボタン disabled 化はしない（ブラウザのオフライン検知に依存しない）
- 失敗時にエラー表示するのみ

## テスト方針

`tests/` 配下、Vitest + @testing-library/react。

**`tests/widgets/post-composer-sheet/PostComposerSheet.test.tsx`**
- `open=true` でシートが開く
- `initialScripture` が節チップとして表示される
- 投稿成功で `onSuccess` が呼ばれる
- 投稿失敗でシートが閉じない、エラー表示される

**`tests/features/select-scripture-verses/useVerseSelection.test.ts`**
- URL search param `?select=1,2` を読み込んで `[1, 2]` を返す
- `toggle(3)` で URL が `?select=1,2,3` になる
- `toggle(2)` で URL が `?select=1,3` になる
- 不正値 `?select=abc,-1,0` を無視して空配列を返す
- 章の節数を超える値は除外

**`tests/features/select-scripture-verses/SelectionBar.test.tsx`**
- 選択 0 件で非表示（`data-open` 属性など）
- 選択 1 件以上で表示、正しいラベルを含む
- 「クリア」で `onClear` が呼ばれる
- 「投稿」で `onOpenComposer` が呼ばれる

**`tests/widgets/post-editor/PostEditor.test.tsx`**（既存を拡張）
- `mode='sheet'` + `onSuccess` で投稿完了時 `onSuccess` が呼ばれ、navigate されない
- `initialScripture` が異なると異なる下書きキーが使われる
- グローバルキー（`mode='page'`）と節別キー（`mode='sheet'`）が干渉しない

**手動検証（`verify` skill 使用）:**
- 節ビューから投稿してシート内で節を追加削除できる
- 章ビューでチェックボックス選択→投稿→投稿カードが章ビュー上に反映
- 投稿完了後もページ遷移せず、続けて別の節に投稿できる
- iOS Safari でキーボード表示時にシートが正しくリサイズされる

## スコープ外（今回は実装しない）

- 章ビューで節本文の任意箇所をハイライト → 引用付き投稿
- シートを開いたまま背後の別節をタップして選択に追加（バックドロップ透過タップ）
- デスクトップ幅での分割レイアウト（左: 聖典、右: エディタ）
- 既存グローバル下書きから節別下書きへの自動移行
- 「下書きを破棄」ボタン

## 主要な設計判断

**なぜ節本文をシート内に表示しないか**

シート初期高さ 70dvh + 背後聖典画面が見えるため、シート内に本文を出すと縦スクロール領域が重複する。シート下端をドラッグして節本文を確認する動作が自然。

**なぜ `?select=` を URL に持たせるか**

戻る操作でシートを閉じたときに選択状態が保たれ、シートを開き直せる。またログイン誘導後の復帰でも状態が失われない。

**なぜ下書きを節ごとに分離するか**

現状は「別の節の下書きが残っている」状態が起きうる。分離すれば「その節での前回の下書き」だけが復元されるため、混乱が減る。

**なぜ投稿完了後にホーム遷移しないか**

「読みながら投稿」の狙いは、読書と投稿の心理的コストを下げること。投稿ごとにホームに戻されると連続投稿・読書継続が途切れる。
