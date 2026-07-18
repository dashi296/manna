# 投稿作成画面 設計書

**Issue:** #6
**Date:** 2026-06-28

---

## アーキテクチャ (FSD レイヤー構成)

```
shared/ui/MarkdownRenderer.tsx          ← react-markdown + remark-gfm ラッパー
features/choose-visibility/
  ui/VisibilitySelector.tsx             ← 4段階公開範囲トグル (TDD)
  index.ts
features/select-scripture/
  ui/ScriptureSelector.tsx              ← コレクション/書籍/章/節セレクター
  index.ts
widgets/post-editor/
  ui/PostEditor.tsx                     ← 統合フォーム (編集/プレビュー切替、下書き保存)
  index.ts
pages/posts/new.tsx                     ← ルート (認証済み前提、クエリパラメータで聖典自動入力)
```

---

## コンポーネント設計

### MarkdownRenderer (shared/ui)

`react-markdown` + `remark-gfm` のラッパー。投稿表示と編集プレビューの両方で使用。

Props: `{ content: string; className?: string }`

### VisibilitySelector (features/choose-visibility)

shadcn `toggle-group` ベースの4ボタン。

| 値 | ラベル | アイコン |
|---|---|---|
| `public` | 全体公開 | Globe |
| `followers` | フォロワー | Users |
| `family` | ファミリー | Heart |
| `private` | 自分のみ | Lock |

Props: `{ value: string; onChange: (v: string) => void }`

デフォルト値: `public`

### ScriptureSelector (features/select-scripture)

3段の shadcn `select` + `input`:

1. コレクション選択 (`getAllCollections()`)
2. 書籍選択 (`getCollection(id).books`)
3. 章選択 (`getBook(collection, book).chapters` → 1〜N)
4. 節入力 (カンマ区切りテキスト: `7, 9` → `[7, 9]`)

全て任意入力。上位が未選択なら下位は disabled。

Props:
```typescript
{
  value: {
    collection?: string
    book?: string
    chapter?: number
    verses?: number[]
  }
  onChange: (ref: ScriptureRef) => void
}
```

### PostEditor (widgets/post-editor)

統合フォーム:

- **編集/プレビュー切替**: タブで textarea ↔ MarkdownRenderer を切替
- **聖典参照**: ScriptureSelector
- **公開範囲**: VisibilitySelector
- **下書き自動保存**: `localStorage` キー `manna:post-draft`、内容変更時に保存
- **送信**: Supabase INSERT → 下書きクリア → `/` へリダイレクト
- **バリデーション**: content が空の場合は送信不可

### pages/posts/new.tsx

- 認証ガード済み (既存の `__root.tsx` で対応)
- クエリパラメータ `?collection=&book=&chapter=&verses=` で ScriptureSelector を自動入力
- PageHeader + PostEditor を配置

---

## データフロー

```
聖典ページ → /posts/new?collection=bofm&book=1-ne&chapter=3&verses=7,9
                ↓
PostEditor (state: content, visibility, scriptureRef)
                ↓ localStorage 自動保存
                ↓ 送信
supabase.auth.getUser() → user.id
                ↓
supabase.from('posts').insert({
  user_id: user.id,   -- NOT NULL。RLS posts_insert_own が auth.uid() = user_id を強制
  content,
  visibility,
  scripture_collection,
  scripture_book,
  scripture_chapter,
  scripture_verses
})
                ↓
成功 → localStorage クリア → navigate('/')
```

※ `user_id` に他人の ID を指定しても、RLS の `WITH CHECK ((select auth.uid()) = user_id)` により挿入は拒否される（JWT 由来の `auth.uid()` はクライアントから偽装不可）。

---

## テスト (TDD)

| コンポーネント | テスト内容 |
|---|---|
| VisibilitySelector | 4選択肢レンダー、値変更コールバック、デフォルト値 |
| MarkdownRenderer | Markdown → HTML レンダー確認 |

---

## DB スキーマ (既存)

```sql
posts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  content text NOT NULL CHECK (length(content) > 0),
  visibility visibility_type DEFAULT 'public',  -- public | followers | family | private
  scripture_collection text,
  scripture_book text,
  scripture_chapter integer,
  scripture_verses integer[],  -- GIN index
  created_at timestamptz,
  updated_at timestamptz
)
```

## 依存パッケージ (全て導入済み)

- `react-markdown` ^10.1.0
- `remark-gfm` ^4.0.1
- shadcn/ui: toggle-group, select, input, button
