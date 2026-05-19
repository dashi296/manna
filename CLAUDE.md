# Manna — Claude Code コンテキスト

末日聖徒イエスキリスト教会の聖典学習体験共有SNS。聖典を読んで感じた感動・洞察・感想をオンラインで共有する。

詳細計画: [`docs/superpowers/plans/2026-05-19-manna-phase1.md`](docs/superpowers/plans/2026-05-19-manna-phase1.md)

---

## 技術スタック

- **フロントエンド**: TanStack Start (TypeScript / Vite / SSR)
- **UI**: shadcn/ui (Radix UI + TailwindCSS v4)
- **バックエンド / DB**: Supabase (PostgreSQL + Auth + Realtime)
- **認証**: Google OAuth (Supabase Auth経由)
- **テスト**: Vitest + @testing-library/react

---

## アーキテクチャ: Feature Sliced Design (FSD)

```
pages/      ← TanStack Start の routesDirectory 兼 FSD 最上位層
widgets/    ← 複合UIブロック（複数の feature/entity を組み合わせる）
features/   ← ユーザー操作・ビジネスロジック
entities/   ← ビジネスエンティティ (post / user / scripture)
shared/     ← 共有インフラ (supabase / auth / shadcn/ui)
```

**インポートルール（上位層→下位層のみ可）:**

| 層 | import 可能な層 |
|---|---|
| pages | widgets / features / entities / shared |
| widgets | features / entities / shared |
| features | entities / shared |
| entities | shared |
| shared | なし |

- 各スライスは `index.ts` でパブリック API を公開する
- スライス内部への直接 import 禁止（外部からは必ず `index.ts` 経由）

---

## 重要な設定・パス

- **`@/` エイリアス**: プロジェクトルート（`.`）を指す
- **`pages/` = routesDirectory**: `app.config.ts` で `tsr.routesDirectory: './pages'` を設定
- **Supabase クライアント**: `@supabase/supabase-js` の `createClient`（`@supabase/ssr` の `createBrowserClient` ではない）

```typescript
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

---

## 重要なデータ設計

### scripture_verses は integer[]（配列型）

```sql
-- posts テーブル
scripture_verses integer[],  -- 任意の節集合（連続・飛び番どちらも可）
-- GIN インデックスあり
CREATE INDEX posts_scripture_verses_gin ON posts USING GIN (scripture_verses);
```

アプリ側では `.overlaps()` で OR 検索（「いずれかの節を含む投稿」）:

```typescript
.overlaps('scripture_verses', search.verses)
```

### family_relationships は双方向

requester/addressee の区別があるため、両方向を検索する必要がある:

```typescript
.or(
  `and(requester_id.eq.${userId},addressee_id.eq.${targetId}),` +
  `and(requester_id.eq.${targetId},addressee_id.eq.${userId})`
)
```

### 認証ガード

`/scriptures/*` は未ログインでも閲覧可。`/` は完全一致で認証必須:

```typescript
const AUTH_REQUIRED_PREFIXES = ['/posts/new', '/profile', '/notifications']
const needsAuth =
  location.pathname === '/' ||
  AUTH_REQUIRED_PREFIXES.some(p => location.pathname.startsWith(p))
```

---

## コーディング規約

- コメントは原則不要。WHY が自明でない場合のみ1行で記載
- UIコンポーネントは TDD（失敗テスト → 実装 → 通過）で実装
- コンポーネントのテストは `tests/` ディレクトリ下に配置
- FSD スライスを新規作成したら必ず `index.ts` を作成する
