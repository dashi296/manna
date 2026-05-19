# Manna Phase 1 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TanStack Start + Supabase で聖典学習体験共有PWAを構築する（Phase 1: PWAのみ）

**Architecture:** TanStack Start（SSR + ファイルベースルーティング）がSupabase JS Clientを介してSupabaseに直接接続。公開範囲制御はDB層のRLSで強制。聖典テキストは持たず静的JSONの書誌データのみ同梱し、本文は公式サイトへのディープリンクで参照する。

**Tech Stack:** TanStack Start, TypeScript, TailwindCSS v4, **shadcn/ui** (Radix UI + Tailwind), Supabase (PostgreSQL + Auth + Realtime + Storage), Vitest, @testing-library/react, @uiw/react-md-editor, react-markdown

**shadcn/ui コンポーネント対応表:**
| 自作コンポーネント | 置き換え先 |
|---|---|
| Button 系 | `Button` |
| Select/Dropdown | `Select` |
| 公開範囲セレクター | `ToggleGroup` |
| 通知・カード | `Card` |
| Avatar | `Avatar` |
| トースト | `Sonner` (toast) |
| ダイアログ | `Dialog` |

---

## ファイル構成

```
manna/
├── app/
│   └── routes/                     # TanStack Startのルート定義（薄いラッパー）
│       ├── __root.tsx              # ルートレイアウト
│       ├── index.tsx               # / → FeedPage
│       ├── login.tsx               # /login
│       ├── scriptures/
│       │   ├── index.tsx
│       │   └── $collection/
│       │       ├── index.tsx
│       │       └── $book/
│       │           ├── index.tsx
│       │           └── $chapter.tsx
│       ├── posts/
│       │   ├── new.tsx
│       │   └── $id.tsx
│       ├── profile/
│       │   ├── index.tsx
│       │   └── $userId.tsx
│       └── notifications.tsx
│
│   # ── Feature Sliced Design 層（app/routes/ からのみ import される） ──
│
├── pages/                          # ページコンポーネント（routes の実装本体）
│   ├── feed/ui/FeedPage.tsx
│   ├── scripture-list/ui/ScriptureListPage.tsx
│   ├── scripture-book/ui/ScriptureBookPage.tsx
│   ├── scripture-chapter/ui/ScriptureChapterPage.tsx
│   ├── post-new/ui/PostNewPage.tsx
│   ├── post-detail/ui/PostDetailPage.tsx
│   ├── profile/ui/ProfilePage.tsx
│   └── notifications/ui/NotificationsPage.tsx
│
├── widgets/                        # 複合UIブロック（複数のfeature/entityを組み合わせる）
│   ├── post-feed/
│   │   ├── ui/PostFeed.tsx         # フィードリスト全体
│   │   └── index.ts
│   ├── post-editor/
│   │   ├── ui/PostEditor.tsx       # 投稿フォーム全体
│   │   └── index.ts
│   └── scripture-nav/
│       ├── ui/ScriptureNav.tsx     # 聖典ナビゲーター
│       └── index.ts
│
├── features/                       # ユーザー操作・ビジネスロジック
│   ├── create-post/
│   │   ├── ui/CreatePostForm.tsx
│   │   └── index.ts
│   ├── follow-user/
│   │   ├── ui/FollowButton.tsx
│   │   └── index.ts
│   ├── manage-family/
│   │   ├── ui/FamilyButton.tsx
│   │   └── index.ts
│   ├── select-scripture/
│   │   ├── ui/ScriptureSelector.tsx
│   │   └── index.ts
│   └── choose-visibility/
│       ├── ui/VisibilitySelector.tsx
│       └── index.ts
│
├── entities/                       # ビジネスエンティティ
│   ├── post/
│   │   ├── model/types.ts          # Post型定義
│   │   ├── ui/PostCard.tsx
│   │   ├── api/postApi.ts          # Supabase CRUD
│   │   └── index.ts
│   ├── user/
│   │   ├── model/types.ts
│   │   ├── ui/Avatar.tsx
│   │   ├── api/userApi.ts
│   │   └── index.ts
│   └── scripture/
│       ├── model/types.ts          # ScriptureRef型
│       ├── lib/scriptureUtils.ts   # URLビルダー・ラベル生成
│       └── index.ts
│
├── shared/                         # 共有インフラ（どの層からもimport可）
│   ├── ui/                         # shadcn/ui コンポーネント置き場
│   ├── lib/
│   │   ├── supabase.ts             # Supabase Browserクライアント
│   │   └── auth.ts                 # 認証ヘルパー
│   ├── config/
│   │   └── scriptures.json         # 静的書誌データ
│   └── types/
│       └── database.ts             # Supabase CLI生成型
│
├── supabase/
│   ├── migrations/
│   │   ├── 20260519000001_initial_schema.sql
│   │   ├── 20260519000002_rls_policies.sql
│   │   └── 20260519000003_triggers.sql
│   └── config.toml
├── tests/
│   ├── entities/
│   │   ├── scripture/scriptureUtils.test.ts
│   │   └── post/PostCard.test.tsx
│   └── features/
│       ├── choose-visibility/VisibilitySelector.test.tsx
│       └── follow-user/FollowButton.test.tsx
├── public/
│   ├── manifest.json
│   └── icons/
├── app.config.ts
├── vite.config.ts
├── tailwind.config.ts
└── vitest.config.ts

## FSDインポートルール

| import元 \ import先 | app | pages | widgets | features | entities | shared |
|---|---|---|---|---|---|---|
| app/routes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| pages | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| widgets | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| features | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| entities | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| shared | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

各スライス（機能単位フォルダ）は `index.ts` でパブリックAPIを公開し、外部からは `index.ts` 経由でのみimportする。スライス内部への直接importは禁止。
```

---

## Task 1: プロジェクトセットアップ

**Files:**
- Create: `app.config.ts`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `tailwind.config.ts`

- [ ] **Step 1: TanStack Startプロジェクトを作成する**

```bash
npm create tsrouter-app@latest . -- --framework start --typescript --tailwind --package-manager npm
```

プロジェクト名は `manna`。

- [ ] **Step 2: 追加パッケージをインストールする**

```bash
npm install @supabase/supabase-js @uiw/react-md-editor react-markdown remark-gfm
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

- [ ] **Step 2b: shadcn/ui を初期化する**

TanStack StartはViteベースなのでViteのセットアップ手順を使う。

```bash
npx shadcn@latest init
```

プロンプトの回答:
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

初期化後、よく使うコンポーネントを一括追加する:

```bash
npx shadcn@latest add button card avatar select toggle-group dialog sonner badge separator
```

`app/globals.css`（またはshadcnが指定するCSSファイル）が生成・更新されたことを確認する。

- [ ] **Step 3: `vite.config.ts` に `@/` パスエイリアスを設定する**

TanStack StartがViteの設定を上書きする場合は `app.config.ts` 側にも同様に追加する。

```typescript
// vite.config.ts（または app.config.ts の vite オプション）
import path from 'path'

resolve: {
  alias: {
    '@': path.resolve(__dirname, '.'),
  },
},
```

`tsconfig.json` にも追加する:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  }
}
```

- [ ] **Step 4: `vitest.config.ts` を作成する**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 5: `tests/setup.ts` を作成する**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: `.env.local` を作成する**

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=（supabase start後に表示されるanon keyを貼る）
```

- [ ] **Step 7: `.gitignore` に追記する**

```
.env.local
.env*.local
.superpowers/
```

- [ ] **Step 8: ビルドが通ることを確認する**

```bash
npm run build
```

Expected: エラーなし。

- [ ] **Step 9: コミットする**

```bash
git add -A
git commit -m "feat: initialize TanStack Start project"
```

---

## Task 2: Supabaseスキーマ + RLS

**Files:**
- Create: `supabase/migrations/20260519000001_initial_schema.sql`
- Create: `supabase/migrations/20260519000002_rls_policies.sql`
- Create: `supabase/migrations/20260519000003_triggers.sql`
- Create: `shared/types/database.ts`

- [ ] **Step 1: Supabase CLIをインストールしてローカル起動する**

```bash
npm install -D supabase
npx supabase init
npx supabase start
```

`npx supabase start` の出力から `anon key` と `service_role key` をメモする。

- [ ] **Step 2: 初期スキーマのマイグレーションを作成する**

`supabase/migrations/20260519000001_initial_schema.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE visibility_type AS ENUM ('public', 'followers', 'family', 'private');
CREATE TYPE notification_type AS ENUM ('liked', 'followed', 'family_requested', 'family_accepted');

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0),
  scripture_collection text,
  scripture_book text,
  scripture_chapter integer,
  scripture_verses integer[],
  visibility visibility_type NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE likes (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE TABLE family_relationships (
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 3: RLSポリシーのマイグレーションを作成する**

`supabase/migrations/20260519000002_rls_policies.sql`:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ファミリー判定ヘルパー関数
CREATE OR REPLACE FUNCTION is_family(user_a uuid, user_b uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_relationships
    WHERE status = 'accepted'
    AND (
      (requester_id = user_a AND addressee_id = user_b) OR
      (requester_id = user_b AND addressee_id = user_a)
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- users
CREATE POLICY "users_select_all" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert_self" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_self" ON users FOR UPDATE USING (auth.uid() = id);

-- posts（複数のSELECTポリシーはORで評価される）
CREATE POLICY "posts_select_public" ON posts FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "posts_select_own" ON posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "posts_select_followers" ON posts FOR SELECT
  USING (
    visibility = 'followers'
    AND EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = auth.uid() AND following_id = posts.user_id
    )
  );

CREATE POLICY "posts_select_family" ON posts FOR SELECT
  USING (visibility = 'family' AND is_family(auth.uid(), user_id));

CREATE POLICY "posts_insert_own" ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_update_own" ON posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "posts_delete_own" ON posts FOR DELETE
  USING (auth.uid() = user_id);

-- likes
CREATE POLICY "likes_select_all" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_self" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_self" ON likes FOR DELETE USING (auth.uid() = user_id);

-- follows
CREATE POLICY "follows_select_all" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_self" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_self" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- family_relationships
CREATE POLICY "family_select_own" ON family_relationships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "family_insert_self" ON family_relationships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "family_update_addressee" ON family_relationships FOR UPDATE
  USING (auth.uid() = addressee_id);
CREATE POLICY "family_delete_own" ON family_relationships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- notifications
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
```

- [ ] **Step 4: トリガーのマイグレーションを作成する**

`supabase/migrations/20260519000003_triggers.sql`:

```sql
-- 新規サインアップ時にusersレコードを自動作成
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- いいね時に通知を作成
CREATE OR REPLACE FUNCTION notify_on_like() RETURNS trigger AS $$
DECLARE
  post_owner_id uuid;
BEGIN
  SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
  IF NEW.user_id != post_owner_id THEN
    INSERT INTO notifications (user_id, type, actor_id, post_id)
    VALUES (post_owner_id, 'liked', NEW.user_id, NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_insert
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION notify_on_like();

-- フォロー時に通知を作成
CREATE OR REPLACE FUNCTION notify_on_follow() RETURNS trigger AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'followed', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_follow_insert
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

-- ファミリー招待/承認時に通知を作成
CREATE OR REPLACE FUNCTION notify_on_family_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO notifications (user_id, type, actor_id)
    VALUES (NEW.addressee_id, 'family_requested', NEW.requester_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO notifications (user_id, type, actor_id)
    VALUES (NEW.requester_id, 'family_accepted', NEW.addressee_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_family_change
  AFTER INSERT OR UPDATE ON family_relationships
  FOR EACH ROW EXECUTE FUNCTION notify_on_family_change();

-- posts.updated_at を自動更新
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 5: マイグレーションを適用してTypeScript型を生成する**

```bash
npx supabase db push
npx supabase gen types typescript --local > shared/types/database.ts
```

Expected: `shared/types/database.ts` が生成される。

- [ ] **Step 6: コミットする**

```bash
git add -A
git commit -m "feat: add Supabase schema, RLS policies, and triggers"
```

---

## Task 3: Supabaseクライアント + 認証

**Files:**
- Create: `shared/lib/supabase.ts`
- Create: `shared/lib/auth.ts`
- Create: `app/routes/login.tsx`

- [ ] **Step 1: Supabaseクライアントを作成する**

`shared/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

- [ ] **Step 2: 認証ヘルパーを作成する**

`shared/lib/auth.ts`:

```typescript
import { supabase } from './supabase'

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
```

- [ ] **Step 3: SupabaseダッシュボードでGoogle OAuthを有効にする**

1. Supabaseダッシュボード → Authentication → Providers → Google
2. Google Cloud ConsoleでOAuth 2.0クライアントIDを作成
3. 承認済みリダイレクトURIに `http://127.0.0.1:54321/auth/v1/callback` を追加
4. Client IDとClient SecretをSupabaseに貼り付けて保存

- [ ] **Step 4: ログイン画面を作成する**

`app/routes/login.tsx`:

```typescript
import { createFileRoute, redirect } from '@tanstack/react-router'
import { signInWithGoogle, getSession } from '@/shared/lib/auth'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const session = await getSession()
    if (session) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Manna</h1>
        <p className="text-gray-500 mb-8">聖典学習を分かち合う</p>
        <button
          onClick={() => signInWithGoogle()}
          className="px-6 py-3 bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-shadow flex items-center gap-3 mx-auto"
        >
          <img src="/google-icon.svg" alt="" className="w-5 h-5" />
          Googleでサインイン
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: ルートレイアウトに認証状態を追加する**

`app/routes/__root.tsx`（TanStack Startが生成したファイルを編集）:

```typescript
import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import { getSession } from '@/shared/lib/auth'
import { BottomNav } from '@/shared/ui/BottomNav'

// '/' は完全一致で認証必須。'/scriptures/*' は未ログインでも閲覧可能
const AUTH_REQUIRED_PREFIXES = ['/posts/new', '/profile', '/notifications']

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const needsAuth =
      location.pathname === '/' ||
      AUTH_REQUIRED_PREFIXES.some(p => location.pathname.startsWith(p))
    if (needsAuth) {
      const session = await getSession()
      if (!session) throw redirect({ to: '/login' })
    }
  },
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-white">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 6: BottomNavコンポーネントを作成する**

`shared/ui/BottomNav.tsx`:

```typescript
import { Link, useRouterState } from '@tanstack/react-router'

const NAV_ITEMS = [
  { to: '/', label: 'フィード', icon: '🏠' },
  { to: '/scriptures', label: '聖典', icon: '📖' },
  { to: '/posts/new', label: '投稿', icon: '✏️' },
  { to: '/notifications', label: '通知', icon: '🔔' },
  { to: '/profile', label: 'プロフィール', icon: '👤' },
]

export function BottomNav() {
  const { location } = useRouterState()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200">
      <div className="flex">
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.to ||
            (item.to !== '/' && location.pathname.startsWith(item.to))
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center py-2 text-xs gap-1 ${
                active ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 7: 開発サーバーを起動して認証フローを手動確認する**

```bash
npm run dev
```

1. `http://localhost:3000` にアクセス → `/login` にリダイレクトされることを確認
2. Googleサインインボタンをクリック → Google認証 → `/` に戻ることを確認

- [ ] **Step 9: コミットする**

```bash
git add -A
git commit -m "feat: add Supabase client and Google OAuth"
```

---

## Task 4: 聖典データ + URLビルダー

**Files:**
- Create: `shared/config/scriptures.json`
- Create: `entities/scripture/lib/scriptureUtils.ts`
- Create: `tests/entities/scripture/scriptureUtils.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`tests/entities/scripture/scriptureUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildScriptureUrl, getScriptureLabel, getBook, getCollection } from '@/entities/scripture'

describe('buildScriptureUrl', () => {
  it('章のURLを生成する', () => {
    const url = buildScriptureUrl({ collection: 'bofm', book: '1-ne', chapter: 3 })
    expect(url).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn')
  })

  it('単一節のURLを生成する', () => {
    const url = buildScriptureUrl({ collection: 'bofm', book: '1-ne', chapter: 3, verses: [7] })
    expect(url).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn&id=p7')
  })

  it('複数節の場合は先頭節のアンカーでURLを生成する', () => {
    const url = buildScriptureUrl({ collection: 'bofm', book: '1-ne', chapter: 3, verses: [7, 9] })
    expect(url).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn&id=p7')
  })
})

describe('getScriptureLabel', () => {
  it('単一節のラベルを返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: '1-ne', chapter: 3, verses: [7] })
    expect(label).toBe('第1ニーファイ書 3:7')
  })

  it('節なしのラベルを返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: '1-ne', chapter: 3 })
    expect(label).toBe('第1ニーファイ書 第3章')
  })

  it('連続節範囲のラベルを返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: '1-ne', chapter: 3, verses: [7, 8, 9] })
    expect(label).toBe('第1ニーファイ書 3:7–9')
  })

  it('飛び番節のラベルを返す', () => {
    const label = getScriptureLabel({ collection: 'bofm', book: '1-ne', chapter: 3, verses: [7, 9] })
    expect(label).toBe('第1ニーファイ書 3:7, 9')
  })
})

describe('getBook', () => {
  it('書籍データを返す', () => {
    const book = getBook('bofm', '1-ne')
    expect(book?.name).toBe('第1ニーファイ書')
    expect(book?.chapters).toBe(22)
  })

  it('存在しない書籍はundefinedを返す', () => {
    expect(getBook('bofm', 'unknown')).toBeUndefined()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run tests/entities/scripture/scriptureUtils.test.ts
```

Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: 聖典JSONデータを作成する**

`shared/config/scriptures.json`:

```json
{
  "collections": [
    {
      "id": "bofm",
      "name": "モルモン書",
      "books": [
        { "id": "1-ne",   "name": "第1ニーファイ書",     "chapters": 22 },
        { "id": "2-ne",   "name": "第2ニーファイ書",     "chapters": 33 },
        { "id": "jacob",  "name": "ヤコブ書",            "chapters": 7  },
        { "id": "enos",   "name": "エノス書",             "chapters": 1  },
        { "id": "jarom",  "name": "ジャロム書",           "chapters": 1  },
        { "id": "omni",   "name": "オムナイ書",           "chapters": 1  },
        { "id": "w-of-m", "name": "モルモンの言葉",       "chapters": 1  },
        { "id": "mosiah", "name": "モーサヤ書",           "chapters": 29 },
        { "id": "alma",   "name": "アルマ書",             "chapters": 63 },
        { "id": "hel",    "name": "ヒラマン書",           "chapters": 16 },
        { "id": "3-ne",   "name": "第3ニーファイ書",      "chapters": 30 },
        { "id": "4-ne",   "name": "第4ニーファイ書",      "chapters": 1  },
        { "id": "morm",   "name": "モルモン書（書）",     "chapters": 9  },
        { "id": "ether",  "name": "エテル書",             "chapters": 15 },
        { "id": "moro",   "name": "モロナイ書",           "chapters": 10 }
      ]
    },
    {
      "id": "dc-testament",
      "name": "教義と聖約",
      "books": [
        { "id": "dc", "name": "教義と聖約", "chapters": 138 }
      ]
    },
    {
      "id": "pgp",
      "name": "高価な真珠",
      "books": [
        { "id": "moses",   "name": "モーセ書",         "chapters": 8 },
        { "id": "abr",     "name": "アブラハム書",      "chapters": 5 },
        { "id": "js-m",    "name": "ジョセフ・スミス—マタイ", "chapters": 1 },
        { "id": "js-h",    "name": "ジョセフ・スミス—歴史", "chapters": 1 },
        { "id": "a-of-f",  "name": "信仰箇条",         "chapters": 1 }
      ]
    },
    {
      "id": "ot",
      "name": "旧約聖書",
      "books": [
        { "id": "gen",  "name": "創世記",     "chapters": 50 },
        { "id": "ex",   "name": "出エジプト記", "chapters": 40 },
        { "id": "ps",   "name": "詩篇",       "chapters": 150 },
        { "id": "isa",  "name": "イザヤ書",   "chapters": 66 }
      ]
    },
    {
      "id": "nt",
      "name": "新約聖書",
      "books": [
        { "id": "matt", "name": "マタイ",   "chapters": 28 },
        { "id": "mark", "name": "マルコ",   "chapters": 16 },
        { "id": "luke", "name": "ルカ",     "chapters": 24 },
        { "id": "john", "name": "ヨハネ",   "chapters": 21 },
        { "id": "rev",  "name": "ヨハネの黙示録", "chapters": 22 }
      ]
    }
  ]
}
```

- [ ] **Step 4: scripture.tsを実装する**

`entities/scripture/lib/scriptureUtils.ts`:

```typescript
import scripturesData from '@/shared/config/scriptures.json'

export type ScriptureRef = {
  collection: string
  book: string
  chapter?: number
  verses?: number[]  // 任意の節集合（連続・飛び番どちらも可）
}

export function buildScriptureUrl(ref: ScriptureRef): string {
  const base = `https://www.churchofjesuschrist.org/study/scriptures`
  let url = `${base}/${ref.collection}/${ref.book}/${ref.chapter}?lang=jpn`
  const first = ref.verses?.[0]
  if (first) url += `&id=p${first}`
  return url
}

export function getScriptureLabel(ref: ScriptureRef): string {
  const book = getBook(ref.collection, ref.book)
  const bookName = book?.name ?? ref.book
  if (!ref.chapter) return bookName
  if (!ref.verses?.length) return `${bookName} 第${ref.chapter}章`
  const sorted = [...ref.verses].sort((a, b) => a - b)
  if (sorted.length === 1) return `${bookName} ${ref.chapter}:${sorted[0]}`
  // 連続ならダッシュ表記、飛び番はカンマ区切り
  const isConsecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)
  if (isConsecutive) return `${bookName} ${ref.chapter}:${sorted[0]}–${sorted[sorted.length - 1]}`
  return `${bookName} ${ref.chapter}:${sorted.join(', ')}`
}

export function getCollection(collectionId: string) {
  return scripturesData.collections.find(c => c.id === collectionId)
}

export function getBook(collectionId: string, bookId: string) {
  return getCollection(collectionId)?.books.find(b => b.id === bookId)
}

export function getAllCollections() {
  return scripturesData.collections
}
```

- [ ] **Step 5: テストを実行して通ることを確認する**

```bash
npx vitest run tests/entities/scripture/scriptureUtils.test.ts
```

Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add -A
git commit -m "feat: add scripture data and URL builder"
```

---

## Task 5: 聖典ナビゲーター画面

**Files:**
- Create: `app/routes/scriptures/index.tsx`
- Create: `app/routes/scriptures/$collection/index.tsx`
- Create: `app/routes/scriptures/$collection/$book/index.tsx`
- Create: `app/routes/scriptures/$collection/$book/$chapter.tsx`

- [ ] **Step 1: 聖典集一覧画面を作成する**

`app/routes/scriptures/index.tsx`:

```typescript
import { createFileRoute, Link } from '@tanstack/react-router'
import { getAllCollections } from '@/entities/scripture'

export const Route = createFileRoute('/scriptures/')({
  component: ScripturesPage,
})

function ScripturesPage() {
  const collections = getAllCollections()
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">聖典</h1>
      <ul className="divide-y border rounded-lg overflow-hidden">
        {collections.map(col => (
          <li key={col.id}>
            <Link
              to="/scriptures/$collection"
              params={{ collection: col.id }}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <span className="font-medium">{col.name}</span>
              <span className="text-gray-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: 書籍一覧画面を作成する**

`app/routes/scriptures/$collection/index.tsx`:

```typescript
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getCollection } from '@/entities/scripture'

export const Route = createFileRoute('/scriptures/$collection/')({
  loader: ({ params }) => {
    const collection = getCollection(params.collection)
    if (!collection) throw notFound()
    return collection
  },
  component: CollectionPage,
})

function CollectionPage() {
  const collection = Route.useLoaderData()
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{collection.name}</h1>
      <ul className="divide-y border rounded-lg overflow-hidden">
        {collection.books.map(book => (
          <li key={book.id}>
            <Link
              to="/scriptures/$collection/$book"
              params={{ collection: collection.id, book: book.id }}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <span>{book.name}</span>
              <span className="text-gray-400 text-sm">{book.chapters}章 ›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: 章一覧画面を作成する**

`app/routes/scriptures/$collection/$book/index.tsx`:

```typescript
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getBook, getCollection } from '@/entities/scripture'

export const Route = createFileRoute('/scriptures/$collection/$book/')({
  loader: ({ params }) => {
    const book = getBook(params.collection, params.book)
    const collection = getCollection(params.collection)
    if (!book || !collection) throw notFound()
    return { book, collection }
  },
  component: BookPage,
})

function BookPage() {
  const { book, collection } = Route.useLoaderData()
  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1)
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{book.name}</h1>
      <div className="grid grid-cols-5 gap-2">
        {chapters.map(ch => (
          <Link
            key={ch}
            to="/scriptures/$collection/$book/$chapter"
            params={{ collection: collection.id, book: book.id, chapter: String(ch) }}
            className="flex items-center justify-center h-12 border rounded-lg hover:bg-blue-50 hover:border-blue-300 text-sm font-medium"
          >
            {ch}
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 節一覧画面（章ページ）+ 節ページを作成する**

`app/routes/scriptures/$collection/$book/$chapter.tsx`:

このファイルは1つで章ページ（節一覧）と節ページ（投稿一覧）を兼ねる（Option A: クエリパラメータ方式）。
- `?verses=7` → 節ページ（節7への投稿一覧）
- `?verses=7,9` → 複数節ページ
- パラメータなし → 章ページ（節一覧）

```typescript
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useState } from 'react'
import { getBook, buildScriptureUrl, getScriptureLabel } from '@/entities/scripture'
import { PostCard } from '@/entities/post'
import { supabase } from '@/shared/lib/supabase'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

const searchSchema = z.object({
  verses: z.array(z.coerce.number()).optional(),
})

const POST_SELECT = `
  id, content, visibility, created_at,
  scripture_collection, scripture_book, scripture_chapter,
  scripture_verses, user_id,
  users ( display_name, avatar_url )
`

export const Route = createFileRoute('/scriptures/$collection/$book/$chapter')({
  validateSearch: zodValidator(searchSchema),
  loader: async ({ params, search }) => {
    const book = getBook(params.collection, params.book)
    if (!book) throw notFound()
    const chapterNum = parseInt(params.chapter)
    if (isNaN(chapterNum)) throw notFound()

    if (search.verses?.length) {
      // 節ページ: この節に関する投稿を取得
      const { data: posts } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('scripture_collection', params.collection)
        .eq('scripture_book', params.book)
        .eq('scripture_chapter', chapterNum)
        .contains('scripture_verses', search.verses)
        .order('created_at', { ascending: false })

      return {
        book, chapter: chapterNum, collection: params.collection,
        mode: 'verse' as const, verses: search.verses,
        posts: posts ?? [], countByVerse: {},
      }
    }

    // 章ページ: 節ごとの投稿数バッジ用にscripture_versesを集計
    const { data: allPosts } = await supabase
      .from('posts')
      .select('scripture_verses')
      .eq('scripture_collection', params.collection)
      .eq('scripture_book', params.book)
      .eq('scripture_chapter', chapterNum)
      .not('scripture_verses', 'is', null)

    const countByVerse: Record<number, number> = {}
    allPosts?.forEach(p => {
      ;(p.scripture_verses as number[])?.forEach(v => {
        countByVerse[v] = (countByVerse[v] ?? 0) + 1
      })
    })

    return {
      book, chapter: chapterNum, collection: params.collection,
      mode: 'chapter' as const, verses: [],
      posts: [], countByVerse,
    }
  },
  component: ChapterPage,
})

function ChapterPage() {
  const { book, chapter, collection, mode, verses, posts, countByVerse } = Route.useLoaderData()
  const [sort, setSort] = useState<'newest' | 'liked'>('newest')

  if (mode === 'verse') {
    const scriptureLabel = getScriptureLabel({ collection, book: book.id, chapter, verses })
    const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter, verses })

    return (
      <div>
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold">📖 {scriptureLabel}</h1>
          <a href={officialUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm text-blue-600 underline">公式サイトで読む →</a>
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="flex gap-3">
            <button onClick={() => setSort('newest')}
              className={`text-sm ${sort === 'newest' ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              新着順
            </button>
            <button onClick={() => setSort('liked')}
              className={`text-sm ${sort === 'liked' ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              人気順
            </button>
          </div>
          <Link
            to="/posts/new"
            search={{ collection, book: book.id, chapter, verses }}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-full"
          >
            この節について投稿する
          </Link>
        </div>
        {posts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">この節への投稿はまだありません</div>
        ) : (
          <div>
            {posts.map((post: any) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // 章ページ: 節一覧を表示
  const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter })
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{book.name} 第{chapter}章</h1>
        <a href={officialUrl} target="_blank" rel="noopener noreferrer"
          className="text-sm text-blue-600 underline">本文を読む →</a>
      </div>
      <p className="text-sm text-gray-500 mb-4">節を選んで投稿を見る・書く</p>
      <ul className="divide-y border rounded-lg overflow-hidden">
        {Array.from({ length: 50 }, (_, i) => i + 1).map(verse => {
          const count = countByVerse[verse] ?? 0
          return (
            <li key={verse}>
              <Link
                to="/scriptures/$collection/$book/$chapter"
                params={{ collection, book: book.id, chapter: String(chapter) }}
                search={{ verses: [verse] }}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <span className="text-sm">第{verse}節</span>
                {count > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {count}件
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

> **Note:** 節数は書籍・章によって異なる。Phase 1では50節を上限として表示し、投稿のない節は空欄で表示する。将来的に節数データをJSONに追加可能。
>
> **複数節指定:** URLは `?verses=7` (単一) または `?verses=7&verses=9` (複数) の形式。`scripture_verses integer[]` カラムにより任意の節集合を保存可能。

- [ ] **Step 5: 開発サーバーで聖典ナビゲーターを手動確認する**

```
/scriptures → 聖典集一覧
/scriptures/bofm → モルモン書の書籍一覧
/scriptures/bofm/1-ne → 第1ニーファイ書の章一覧
/scriptures/bofm/1-ne/3 → 第3章の節一覧（章ページ）
/scriptures/bofm/1-ne/3?verses=7 → 第3章第7節ページ（投稿一覧・投稿ボタン）
/scriptures/bofm/1-ne/3?verses=7&verses=9 → 第7,9節ページ
```

- [ ] **Step 6: コミットする**

```bash
git add -A
git commit -m "feat: add scripture navigator screens"
```

---

## Task 6: 投稿作成画面

**Files:**
- Create: `shared/ui/MarkdownRenderer.tsx`
- Create: `features/select-scripture/ui/ScriptureSelector.tsx`
- Create: `features/choose-visibility/ui/VisibilitySelector.tsx`
- Create: `widgets/post-editor/ui/PostEditor.tsx`
- Create: `app/routes/posts/new.tsx`
- Create: `tests/features/choose-visibility/VisibilitySelector.test.tsx`

- [ ] **Step 1: VisibilitySelectorのテストを書く**

`tests/features/choose-visibility/VisibilitySelector.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VisibilitySelector } from '@/features/choose-visibility'

describe('VisibilitySelector', () => {
  it('4つの選択肢を表示する', () => {
    render(<VisibilitySelector value="public" onChange={vi.fn()} />)
    expect(screen.getByText('公開')).toBeInTheDocument()
    expect(screen.getByText('フォロワー')).toBeInTheDocument()
    expect(screen.getByText('ファミリー')).toBeInTheDocument()
    expect(screen.getByText('非公開')).toBeInTheDocument()
  })

  it('選択するとonChangeを呼ぶ', async () => {
    const onChange = vi.fn()
    render(<VisibilitySelector value="public" onChange={onChange} />)
    await userEvent.click(screen.getByText('非公開'))
    expect(onChange).toHaveBeenCalledWith('private')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run tests/features/choose-visibility/VisibilitySelector.test.tsx
```

Expected: FAIL

- [ ] **Step 3: VisibilitySelectorを実装する**

`features/choose-visibility/ui/VisibilitySelector.tsx`:

```typescript
import type { Database } from '@/shared/types/database'

type Visibility = Database['public']['Enums']['visibility_type']

const OPTIONS: { value: Visibility; label: string; icon: string }[] = [
  { value: 'public',    label: '公開',         icon: '🌐' },
  { value: 'followers', label: 'フォロワー',   icon: '👥' },
  { value: 'family',    label: 'ファミリー',   icon: '👨‍👩‍👧' },
  { value: 'private',   label: '非公開',       icon: '🔒' },
]

type Props = {
  value: Visibility
  onChange: (v: Visibility) => void
}

export function VisibilitySelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition-colors ${
            value === opt.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
          }`}
        >
          <span>{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

```bash
npx vitest run tests/features/choose-visibility/VisibilitySelector.test.tsx
```

Expected: PASS

- [ ] **Step 5: MarkdownRendererを実装する**

`shared/ui/MarkdownRenderer.tsx`:

```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = { content: string; className?: string }

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={`prose prose-sm max-w-none ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 6: ScriptureSelectorを実装する**

`features/select-scripture/ui/ScriptureSelector.tsx`:

```typescript
import { useState } from 'react'
import { getAllCollections, getBook } from '@/entities/scripture'
import type { ScriptureRef } from '@/entities/scripture'

type Props = {
  value: ScriptureRef | null
  onChange: (ref: ScriptureRef | null) => void
}

export function ScriptureSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [collection, setCollection] = useState(value?.collection ?? '')
  const [book, setBook] = useState(value?.book ?? '')
  const [chapter, setChapter] = useState(value?.chapter?.toString() ?? '')
  const [verseInput, setVerseInput] = useState(value?.verses?.join(', ') ?? '')

  const collections = getAllCollections()
  const books = collection ? (collections.find(c => c.id === collection)?.books ?? []) : []
  const bookData = collection && book ? getBook(collection, book) : null
  const chapterCount = bookData?.chapters ?? 0

  const handleApply = () => {
    if (!collection || !book || !chapter) { onChange(null); setOpen(false); return }
    // カンマ区切りで複数節を指定可能（例: "7, 9" → [7, 9]）
    const verses = verseInput
      ? verseInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : undefined
    onChange({
      collection,
      book,
      chapter: parseInt(chapter),
      verses: verses?.length ? verses : undefined,
    })
    setOpen(false)
  }

  if (!open) {
    const label = value
      ? `📖 ${value.collection}/${value.book} ${value.chapter}章${value.verses?.length ? `:${value.verses.join(', ')}節` : ''}`
      : '聖典参照を追加'
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-sm text-blue-600 underline">
        {label}
      </button>
    )
  }

  return (
    <div className="border rounded-lg p-3 space-y-2 text-sm">
      <select value={collection} onChange={e => { setCollection(e.target.value); setBook(''); setChapter('') }}
        className="w-full border rounded px-2 py-1">
        <option value="">聖典集を選択</option>
        {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {collection && (
        <select value={book} onChange={e => { setBook(e.target.value); setChapter('') }}
          className="w-full border rounded px-2 py-1">
          <option value="">書籍を選択</option>
          {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      {book && (
        <select value={chapter} onChange={e => setChapter(e.target.value)}
          className="w-full border rounded px-2 py-1">
          <option value="">章を選択</option>
          {Array.from({ length: chapterCount }, (_, i) => i + 1).map(n =>
            <option key={n} value={n}>第{n}章</option>
          )}
        </select>
      )}
      {chapter && (
        <input type="text" value={verseInput} onChange={e => setVerseInput(e.target.value)}
          placeholder="節番号（任意）。複数はカンマ区切り: 7, 9"
          className="w-full border rounded px-2 py-1" />
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => { onChange(null); setOpen(false) }}
          className="text-gray-500 text-sm">クリア</button>
        <button type="button" onClick={handleApply}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm">決定</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: PostEditorコンポーネントを実装する**

`widgets/post-editor/ui/PostEditor.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { MarkdownRenderer } from '@/shared/ui/MarkdownRenderer'
import { ScriptureSelector } from '@/features/select-scripture'
import { VisibilitySelector } from '@/features/choose-visibility'
import { supabase } from '@/shared/lib/supabase'
import type { ScriptureRef } from '@/entities/scripture'
import type { Database } from '@/shared/types/database'

type Visibility = Database['public']['Enums']['visibility_type']

const DRAFT_KEY = 'manna:post-draft'

type Props = {
  initialRef?: ScriptureRef
  onSuccess?: () => void
}

export function PostEditor({ initialRef, onSuccess }: Props) {
  const [content, setContent] = useState('')
  const [scriptureRef, setScriptureRef] = useState<ScriptureRef | null>(initialRef ?? null)
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [preview, setPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 下書き復元
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY)
    if (draft) setContent(draft)
  }, [])

  // 下書き保存
  useEffect(() => {
    if (content) localStorage.setItem(DRAFT_KEY, content)
    else localStorage.removeItem(DRAFT_KEY)
  }, [content])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未ログイン')
      const { error: err } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content.trim(),
        visibility,
        scripture_collection: scriptureRef?.collection ?? null,
        scripture_book: scriptureRef?.book ?? null,
        scripture_chapter: scriptureRef?.chapter ?? null,
        scripture_verses: scriptureRef?.verses ?? null,
      })
      if (err) throw err
      localStorage.removeItem(DRAFT_KEY)
      setContent('')
      setScriptureRef(null)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '投稿に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <ScriptureSelector value={scriptureRef} onChange={setScriptureRef} />

      <div className="flex gap-2 text-sm border-b pb-2">
        <button type="button" onClick={() => setPreview(false)}
          className={preview ? 'text-gray-400' : 'text-blue-600 font-medium'}>編集</button>
        <button type="button" onClick={() => setPreview(true)}
          className={preview ? 'text-blue-600 font-medium' : 'text-gray-400'}>プレビュー</button>
      </div>

      {preview ? (
        <MarkdownRenderer content={content} className="min-h-32" />
      ) : (
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="感想・洞察をMarkdownで書く..."
          className="w-full min-h-48 border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          required
        />
      )}

      <VisibilitySelector value={visibility} onChange={setVisibility} />

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !content.trim()}
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50"
      >
        {submitting ? '投稿中...' : '投稿する'}
      </button>
    </form>
  )
}
```

- [ ] **Step 8: 投稿作成ルートを作成する**

`app/routes/posts/new.tsx`:

```typescript
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { PostEditor } from '@/widgets/post-editor'
import type { ScriptureRef } from '@/entities/scripture'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

const searchSchema = z.object({
  collection: z.string().optional(),
  book: z.string().optional(),
  chapter: z.coerce.number().optional(),
  verses: z.array(z.coerce.number()).optional(),
})

export const Route = createFileRoute('/posts/new')({
  validateSearch: zodValidator(searchSchema),
  component: NewPostPage,
})

function NewPostPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/posts/new' })

  const initialRef: ScriptureRef | undefined =
    search.collection && search.book && search.chapter
      ? { collection: search.collection, book: search.book, chapter: search.chapter, verses: search.verses }
      : undefined

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <button onClick={() => navigate({ to: '/' })} className="text-gray-500">✕</button>
        <h1 className="font-semibold">新しい投稿</h1>
      </div>
      <PostEditor
        initialRef={initialRef}
        onSuccess={() => navigate({ to: '/' })}
      />
    </div>
  )
}
```

- [ ] **Step 9: 投稿作成を手動確認する**

1. `/posts/new` にアクセス
2. 聖典参照を選択
3. Markdownで内容を書いてプレビューを確認
4. 公開範囲を選択して投稿
5. Supabaseダッシュボードでレコードが作成されたことを確認

- [ ] **Step 10: コミットする**

```bash
git add -A
git commit -m "feat: add post creation with Markdown and visibility selector"
```

---

## Task 7: フィード画面 + PostCard

**Files:**
- Create: `entities/post/ui/PostCard.tsx`
- Create: `entities/user/ui/Avatar.tsx`
- Create: `app/routes/index.tsx`
- Create: `tests/entities/post/PostCard.test.tsx`

- [ ] **Step 1: PostCardのテストを書く**

`tests/entities/post/PostCard.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostCard } from '@/entities/post'

const mockPost = {
  id: 'post-1',
  content: '**感動的な言葉**です',
  visibility: 'public' as const,
  created_at: '2026-05-19T00:00:00Z',
  scripture_collection: 'bofm',
  scripture_book: '1-ne',
  scripture_chapter: 3,
  scripture_verses: [7],
  user_id: 'user-1',
  users: { display_name: '山田太郎', avatar_url: null },
}

describe('PostCard', () => {
  it('ユーザー名を表示する', () => {
    render(<PostCard post={mockPost} />)
    expect(screen.getByText('山田太郎')).toBeInTheDocument()
  })

  it('聖典参照を表示する', () => {
    render(<PostCard post={mockPost} />)
    expect(screen.getByText(/第1ニーファイ書 3:7/)).toBeInTheDocument()
  })

  it('Markdownをレンダリングする', () => {
    render(<PostCard post={mockPost} />)
    expect(screen.getByRole('strong')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx vitest run tests/entities/post/PostCard.test.tsx
```

Expected: FAIL

- [ ] **Step 3: Avatarコンポーネントを実装する**

`entities/user/ui/Avatar.tsx`:

```typescript
type Props = { url?: string | null; name: string; size?: 'sm' | 'md' }

export function Avatar({ url, name, size = 'md' }: Props) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  if (url) {
    return <img src={url} alt={name} className={`${dim} rounded-full object-cover`} />
  }
  return (
    <div className={`${dim} rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-800`}>
      {name[0]?.toUpperCase()}
    </div>
  )
}
```

- [ ] **Step 4: PostCardコンポーネントを実装する**

`entities/post/ui/PostCard.tsx`:

```typescript
import { Link } from '@tanstack/react-router'
import { Avatar } from '@/entities/user'
import { MarkdownRenderer } from '@/shared/ui/MarkdownRenderer'
import { getScriptureLabel } from '@/entities/scripture'

type Post = {
  id: string
  content: string
  visibility: string
  created_at: string
  scripture_collection: string | null
  scripture_book: string | null
  scripture_chapter: number | null
  scripture_verses: number[] | null
  user_id: string
  users: { display_name: string; avatar_url: string | null }
}

type Props = { post: Post }

export function PostCard({ post }: Props) {
  const scriptureLabel = post.scripture_collection && post.scripture_book && post.scripture_chapter
    ? getScriptureLabel({
        collection: post.scripture_collection,
        book: post.scripture_book,
        chapter: post.scripture_chapter,
        verses: post.scripture_verses ?? undefined,
      })
    : null

  return (
    <div className="p-4 border-b">
      <div className="flex items-start gap-3">
        <Link to="/profile/$userId" params={{ userId: post.user_id }}>
          <Avatar url={post.users.avatar_url} name={post.users.display_name} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link to="/profile/$userId" params={{ userId: post.user_id }}
              className="font-semibold text-sm hover:underline">
              {post.users.display_name}
            </Link>
            <span className="text-xs text-gray-400">
              {new Date(post.created_at).toLocaleDateString('ja-JP')}
            </span>
          </div>
          {scriptureLabel && (
            <Link
              to="/scriptures/$collection/$book/$chapter"
              params={{
                collection: post.scripture_collection!,
                book: post.scripture_book!,
                chapter: String(post.scripture_chapter!),
              }}
              className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded mb-2 hover:bg-blue-100"
            >
              📖 {scriptureLabel}
            </Link>
          )}
          <MarkdownRenderer content={post.content} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: テストを実行して通ることを確認する**

```bash
npx vitest run tests/entities/post/PostCard.test.tsx
```

Expected: PASS

- [ ] **Step 6: フィード画面を実装する**

`app/routes/index.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { PostCard } from '@/entities/post'

const POST_SELECT = `
  id, content, visibility, created_at,
  scripture_collection, scripture_book, scripture_chapter,
  scripture_verses, user_id,
  users ( display_name, avatar_url )
`

export const Route = createFileRoute('/')({
  component: FeedPage,
})

function FeedPage() {
  const [tab, setTab] = useState<'following' | 'public'>('following')
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const load = async () => {
      if (tab === 'following') {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setPosts([]); setLoading(false); return }
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
        const ids = following?.map(f => f.following_id) ?? []
        if (ids.length === 0) { setPosts([]); setLoading(false); return }
        const { data } = await supabase
          .from('posts')
          .select(POST_SELECT)
          .in('user_id', ids)
          .order('created_at', { ascending: false })
          .limit(20)
        setPosts(data ?? [])
      } else {
        const { data } = await supabase
          .from('posts')
          .select(POST_SELECT)
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(20)
        setPosts(data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [tab])

  return (
    <div>
      <div className="flex border-b sticky top-0 bg-white z-10">
        {(['following', 'public'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}>
            {t === 'following' ? 'フォロー中' : '全体'}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="p-8 text-center text-gray-400">読み込み中...</div>
      ) : posts.length === 0 ? (
        <div className="p-8 text-center text-gray-400">投稿はまだありません</div>
      ) : (
        <div>
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: 開発サーバーでフィードを手動確認する**

1. フィードに投稿が表示されることを確認
2. 「フォロー中」タブと「全体」タブの切り替えを確認

- [ ] **Step 9: コミットする**

```bash
git add -A
git commit -m "feat: add feed screen and PostCard component"
```

---

## Task 8: フォロー + ファミリー機能

**Files:**
- Create: `features/follow-user/ui/FollowButton.tsx`
- Create: `features/manage-family/ui/FamilyButton.tsx`

- [ ] **Step 1: FollowButtonを実装する**

`features/follow-user/ui/FollowButton.tsx`:

```typescript
import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

type Props = {
  targetUserId: string
  currentUserId: string
  initialFollowing: boolean
}

export function FollowButton({ targetUserId, currentUserId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, setPending] = useState(false)

  const toggle = async () => {
    if (pending) return
    setPending(true)
    if (following) {
      await supabase.from('follows').delete()
        .eq('follower_id', currentUserId).eq('following_id', targetUserId)
      setFollowing(false)
    } else {
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetUserId })
      setFollowing(true)
    }
    setPending(false)
  }

  return (
    <button onClick={toggle} disabled={pending}
      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
        following
          ? 'border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500'
          : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
      }`}>
      {following ? 'フォロー中' : 'フォロー'}
    </button>
  )
}
```

- [ ] **Step 2: FamilyButtonを実装する**

`features/manage-family/ui/FamilyButton.tsx`:

```typescript
import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

type FamilyStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted'

type Props = {
  targetUserId: string
  currentUserId: string
  initialStatus: FamilyStatus
}

export function FamilyButton({ targetUserId, currentUserId, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [pending, setPending] = useState(false)

  const sendRequest = async () => {
    setPending(true)
    const { error } = await supabase.from('family_relationships').insert({
      requester_id: currentUserId,
      addressee_id: targetUserId,
    })
    if (!error) setStatus('pending_sent')
    setPending(false)
  }

  const accept = async () => {
    setPending(true)
    const { error } = await supabase.from('family_relationships').update({ status: 'accepted' })
      .eq('requester_id', targetUserId).eq('addressee_id', currentUserId)
    if (!error) setStatus('accepted')
    setPending(false)
  }

  const remove = async () => {
    setPending(true)
    // current↔target の間のレコードのみ削除（他のファミリー関係を巻き込まない）
    await supabase.from('family_relationships').delete()
      .or(
        `and(requester_id.eq.${currentUserId},addressee_id.eq.${targetUserId}),` +
        `and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`
      )
    setStatus('none')
    setPending(false)
  }

  if (status === 'accepted') {
    return (
      <button onClick={remove} disabled={pending}
        className="px-4 py-1.5 rounded-full text-sm font-medium border border-gray-300 text-gray-600 hover:text-red-500">
        👨‍👩‍👧 ファミリー
      </button>
    )
  }
  if (status === 'pending_sent') {
    return <span className="text-sm text-gray-400">招待送信済み</span>
  }
  if (status === 'pending_received') {
    return (
      <button onClick={accept} disabled={pending}
        className="px-4 py-1.5 rounded-full text-sm font-medium bg-green-600 text-white">
        招待を承認
      </button>
    )
  }
  return (
    <button onClick={sendRequest} disabled={pending}
      className="px-4 py-1.5 rounded-full text-sm font-medium border border-gray-300 text-gray-600 hover:border-blue-400">
      👨‍👩‍👧 ファミリーに追加
    </button>
  )
}
```

- [ ] **Step 3: コミットする**

```bash
git add -A
git commit -m "feat: add follow and family buttons"
```

---

## Task 9: プロフィール画面

**Files:**
- Create: `app/routes/profile/index.tsx`
- Create: `app/routes/profile/$userId.tsx`

- [ ] **Step 1: 自分のプロフィール画面を実装する**

`app/routes/profile/index.tsx`:

```typescript
import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/shared/lib/supabase'

export const Route = createFileRoute('/profile/')({
  loader: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw redirect({ to: '/login' })
    throw redirect({ to: '/profile/$userId', params: { userId: user.id } })
  },
  component: () => null,
})
```

- [ ] **Step 2: ユーザープロフィール画面を実装する**

`app/routes/profile/$userId.tsx`:

```typescript
import { createFileRoute, notFound } from '@tanstack/react-router'
import { supabase } from '@/shared/lib/supabase'
import { Avatar } from '@/entities/user'
import { PostCard } from '@/entities/post'
import { FollowButton } from '@/features/follow-user'
import { FamilyButton } from '@/features/manage-family'

export const Route = createFileRoute('/profile/$userId')({
  loader: async ({ params }) => {
    const [{ data: profile }, { data: { user } }, { data: posts }, { data: followerCount }, { data: followingCount }] =
      await Promise.all([
        supabase.from('users').select('*').eq('id', params.userId).single(),
        supabase.auth.getUser(),
        supabase.from('posts').select(`
          id, content, visibility, created_at,
          scripture_collection, scripture_book, scripture_chapter,
          scripture_verses, user_id,
          users ( display_name, avatar_url )
        `).eq('user_id', params.userId).order('created_at', { ascending: false }),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', params.userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', params.userId),
      ])

    if (!profile) throw notFound()

    const isOwn = user?.id === params.userId
    let isFollowing = false
    let familyStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none'

    if (user && !isOwn) {
      const [{ data: followData }, { data: familyData }] = await Promise.all([
        supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', params.userId).maybeSingle(),
        supabase.from('family_relationships').select('*')
          .or(
            `and(requester_id.eq.${user.id},addressee_id.eq.${params.userId}),` +
            `and(requester_id.eq.${params.userId},addressee_id.eq.${user.id})`
          )
          .maybeSingle(),
      ])
      isFollowing = !!followData
      if (familyData) {
        if (familyData.status === 'accepted') familyStatus = 'accepted'
        else if (familyData.requester_id === user.id) familyStatus = 'pending_sent'
        else familyStatus = 'pending_received'
      }
    }

    return { profile, posts: posts ?? [], currentUserId: user?.id ?? null, isOwn, isFollowing, familyStatus, followerCount, followingCount }
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { profile, posts, currentUserId, isOwn, isFollowing, familyStatus, followerCount, followingCount } = Route.useLoaderData()

  return (
    <div>
      <div className="p-4 border-b">
        <div className="flex items-start gap-4">
          <Avatar url={profile.avatar_url} name={profile.display_name} size="md" />
          <div className="flex-1">
            <h1 className="font-bold text-lg">{profile.display_name}</h1>
            {profile.bio && <p className="text-sm text-gray-600 mt-1">{profile.bio}</p>}
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              <span><strong className="text-gray-900">{followerCount}</strong> フォロワー</span>
              <span><strong className="text-gray-900">{followingCount}</strong> フォロー中</span>
            </div>
          </div>
        </div>
        {!isOwn && currentUserId && (
          <div className="flex gap-2 mt-3">
            <FollowButton targetUserId={profile.id} currentUserId={currentUserId} initialFollowing={isFollowing} />
            <FamilyButton targetUserId={profile.id} currentUserId={currentUserId} initialStatus={familyStatus} />
          </div>
        )}
      </div>
      <div>
        {posts.map((post: any) => (
          <PostCard key={post.id} post={post} currentUserId={currentUserId} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 開発サーバーでプロフィールを手動確認する**

1. `/profile` にアクセス → 自分のプロフィールにリダイレクト
2. 投稿一覧が表示されることを確認
3. 他ユーザーのプロフィールでフォローボタンが表示されることを確認

- [ ] **Step 4: コミットする**

```bash
git add -A
git commit -m "feat: add profile screen with follow and family actions"
```

---

## Task 10: 通知画面

**Files:**
- Create: `app/routes/notifications.tsx`

- [ ] **Step 1: 通知画面を実装する**

`app/routes/notifications.tsx`:

```typescript
import { createFileRoute, Link } from '@tanstack/react-router'
import { supabase } from '@/shared/lib/supabase'
import { useEffect, useState } from 'react'
import { Avatar } from '@/entities/user'

type Notification = {
  id: string
  type: 'liked' | 'followed' | 'family_requested' | 'family_accepted'
  read: boolean
  created_at: string
  actor: { display_name: string; avatar_url: string | null }
  post_id: string | null
}

const LABELS: Record<Notification['type'], string> = {
  liked: 'があなたの投稿にいいねしました',
  followed: 'があなたをフォローしました',
  family_requested: 'がファミリーに招待しました',
  family_accepted: 'がファミリー招待を承認しました',
}

export const Route = createFileRoute('/notifications')({
  component: NotificationsPage,
})

function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, type, read, created_at, post_id, actor:actor_id ( display_name, avatar_url )')
        .order('created_at', { ascending: false })
        .limit(50)
      setNotifications((data as any) ?? [])
      setLoading(false)

      // 全件を既読にする
      await supabase.from('notifications').update({ read: true }).eq('read', false)
    }
    load()
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400">読み込み中...</div>

  return (
    <div>
      <div className="px-4 py-3 border-b font-semibold">通知</div>
      {notifications.length === 0 ? (
        <div className="p-8 text-center text-gray-400">通知はまだありません</div>
      ) : (
        <ul className="divide-y">
          {notifications.map(n => (
            <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${!n.read ? 'bg-blue-50' : ''}`}>
              <Avatar url={n.actor.avatar_url} name={n.actor.display_name} size="sm" />
              <div className="flex-1 text-sm">
                <span className="font-medium">{n.actor.display_name}</span>
                <span className="text-gray-600">{LABELS[n.type]}</span>
                <div className="text-xs text-gray-400 mt-0.5">
                  {new Date(n.created_at).toLocaleDateString('ja-JP')}
                </div>
              </div>
              {n.post_id && (
                <Link to="/posts/$id" params={{ id: n.post_id }} className="text-xs text-blue-600">
                  投稿を見る
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: コミットする**

```bash
git add -A
git commit -m "feat: add notifications screen"
```

---

## Task 11: 投稿詳細画面（節ページ連携）

**Files:**
- Create: `app/routes/posts/$id.tsx`

- [ ] **Step 1: 投稿詳細画面を実装する**

`app/routes/posts/$id.tsx`:

```typescript
import { createFileRoute, notFound, Link } from '@tanstack/react-router'
import { supabase } from '@/shared/lib/supabase'
import { MarkdownRenderer } from '@/shared/ui/MarkdownRenderer'
import { Avatar } from '@/entities/user'
import { getScriptureLabel, buildScriptureUrl } from '@/entities/scripture'

export const Route = createFileRoute('/posts/$id')({
  loader: async ({ params }) => {
    const { data: post } = await supabase.from('posts').select(`
      id, content, visibility, created_at,
      scripture_collection, scripture_book, scripture_chapter,
      scripture_verses, user_id,
      users ( display_name, avatar_url )
    `).eq('id', params.id).single()
    if (!post) throw notFound()
    return { post }
  },
  component: PostDetailPage,
})

function PostDetailPage() {
  const { post } = Route.useLoaderData()

  const scriptureLabel = post.scripture_collection && post.scripture_book && post.scripture_chapter
    ? getScriptureLabel({
        collection: post.scripture_collection,
        book: post.scripture_book,
        chapter: post.scripture_chapter,
        verses: (post.scripture_verses as number[] | null) ?? undefined,
      })
    : null

  const officialUrl = post.scripture_collection && post.scripture_book && post.scripture_chapter
    ? buildScriptureUrl({
        collection: post.scripture_collection,
        book: post.scripture_book,
        chapter: post.scripture_chapter,
        verses: (post.scripture_verses as number[] | null) ?? undefined,
      })
    : null

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/profile/$userId" params={{ userId: post.user_id }}>
          <Avatar url={(post.users as any).avatar_url} name={(post.users as any).display_name} />
        </Link>
        <div>
          <Link to="/profile/$userId" params={{ userId: post.user_id }} className="font-semibold hover:underline">
            {(post.users as any).display_name}
          </Link>
          <div className="text-xs text-gray-400">{new Date(post.created_at).toLocaleDateString('ja-JP')}</div>
        </div>
      </div>

      {scriptureLabel && officialUrl && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
          <div className="font-medium text-blue-800 mb-1">📖 {scriptureLabel}</div>
          <a href={officialUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 underline text-xs">公式サイトで読む →</a>
        </div>
      )}

      <MarkdownRenderer content={post.content} className="mb-4" />
    </div>
  )
}
```

- [ ] **Step 2: コミットする**

```bash
git add -A
git commit -m "feat: add post detail screen"
```

---

## Task 12: PWA設定

**Files:**
- Create: `public/manifest.json`
- Modify: `app/routes/__root.tsx`

- [ ] **Step 1: PWAマニフェストを作成する**

`public/manifest.json`:

```json
{
  "name": "Manna — 聖典学習共有",
  "short_name": "Manna",
  "description": "聖典学習の体験と感想を分かち合う",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "lang": "ja",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: `__root.tsx` のHeadにマニフェストとmeta tagを追加する**

`__root.tsx` の `<head>` 相当の部分（TanStack StartのMeta APIを使用）に追加:

```typescript
// createRootRoute の head オプションに追記
head: () => ({
  links: [{ rel: 'manifest', href: '/manifest.json' }],
  meta: [
    { name: 'theme-color', content: '#2563eb' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
  ],
}),
```

- [ ] **Step 3: アイコン画像を用意する**

```bash
mkdir -p public/icons
```

192x192と512x512のPNGアイコンを `public/icons/` に配置する（任意のデザインツールで作成）。

- [ ] **Step 4: ビルドしてPWAとして動作確認する**

```bash
npm run build && npm run preview
```

Chromeの DevTools → Application → Manifest でマニフェストが読み込まれることを確認する。

- [ ] **Step 5: 最終コミットをする**

```bash
git add -A
git commit -m "feat: add PWA manifest and meta tags"
```

---

## 全テストを実行して確認

```bash
npx vitest run
```

Expected: すべてPASS。

---

## 環境変数一覧（本番デプロイ時）

| 変数名 | 説明 |
|---|---|
| `VITE_SUPABASE_URL` | SupabaseプロジェクトURL |
| `VITE_SUPABASE_ANON_KEY` | Supabase匿名キー |

本番SupabaseプロジェクトはSupabaseダッシュボードで作成し、Google OAuth設定を本番URLで再設定する。
