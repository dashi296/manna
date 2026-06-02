# OAuth コールバック サーバールート移行 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OAuth コード交換を `useEffect`（CSR）から `server.handlers.GET`（SSR）に移行し、サーバーサイドで Set-Cookie を確定させる。

**Architecture:** TanStack Start の `createFileRoute` + `server.handlers` を使い、`/api/auth/callback` をサーバールートとして実装する。`@supabase/ssr` の `createServerClient` で Cookie を読み書きし、302 リダイレクトレスポンスに `Set-Cookie` ヘッダーを付与する。旧クライアントサイドコールバックページは削除する。

**Tech Stack:** TanStack Start (server.handlers), @supabase/ssr (createServerClient, parseCookieHeader, serializeCookieHeader), Vitest

---

## ファイル構成

| 操作 | パス |
|---|---|
| 新規作成 | `apps/pwa/src/pages/api/auth/callback.ts` |
| 新規作成 | `apps/pwa/tests/pages/api/auth/callback.test.ts` |
| 変更 | `apps/pwa/src/shared/lib/auth.ts` |
| 削除 | `apps/pwa/src/pages/auth/callback.tsx` |

---

### Task 1: `isCodeReuseError` のユニットテストを書く

**Files:**
- Create: `apps/pwa/tests/pages/api/auth/callback.test.ts`

- [ ] **Step 1: テストファイルを作成する**

```ts
// apps/pwa/tests/pages/api/auth/callback.test.ts
import { describe, it, expect } from 'vitest'

// テスト対象は後で実装ファイルから export する
// ここでは先に期待動作をテストとして記述しておく
const isCodeReuseError = (err: unknown): boolean => {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('otp_expired') ||
    msg.includes('invalid_grant') ||
    msg.includes('invalid request')
  )
}

describe('isCodeReuseError', () => {
  it('otp_expired を含むエラーメッセージを認識する', () => {
    expect(isCodeReuseError(new Error('otp_expired'))).toBe(true)
  })

  it('invalid_grant を含むエラーメッセージを認識する', () => {
    expect(isCodeReuseError(new Error('invalid_grant'))).toBe(true)
  })

  it('invalid request を含むエラーメッセージを認識する', () => {
    expect(isCodeReuseError(new Error('invalid request'))).toBe(true)
  })

  it('大文字小文字を区別しない', () => {
    expect(isCodeReuseError(new Error('OTP_EXPIRED'))).toBe(true)
  })

  it('文字列エラーも処理できる', () => {
    expect(isCodeReuseError('otp_expired error occurred')).toBe(true)
  })

  it('無関係なエラーは false を返す', () => {
    expect(isCodeReuseError(new Error('network error'))).toBe(false)
  })

  it('null/undefined は false を返す', () => {
    expect(isCodeReuseError(null)).toBe(false)
    expect(isCodeReuseError(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: テストが通ることを確認する（ローカル実装なので通るはず）**

```bash
cd apps/pwa && pnpm test -- --reporter=verbose tests/pages/api/auth/callback.test.ts
```

期待: 7 tests passed

---

### Task 2: サーバールート `pages/api/auth/callback.ts` を作成する

**Files:**
- Create: `apps/pwa/src/pages/api/auth/callback.ts`

- [ ] **Step 1: ファイルを作成する**

```ts
// apps/pwa/src/pages/api/auth/callback.ts
import { createFileRoute } from '@tanstack/react-router'
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import type { Database } from '@manna/database'

export function isCodeReuseError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('otp_expired') ||
    msg.includes('invalid_grant') ||
    msg.includes('invalid request')
  )
}

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = new URL(request.url).searchParams.get('code')

        if (!code) {
          return new Response(null, { status: 302, headers: { Location: '/' } })
        }

        // setAll 内でシリアライズ済みの文字列として収集する（型互換問題を回避）
        const setCookieStrings: string[] = []
        const extraResponseHeaders: Record<string, string> = {}

        const supabase = createServerClient<Database>(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_KEY,
          {
            cookies: {
              getAll: () =>
                parseCookieHeader(request.headers.get('cookie') ?? '').map(({ name, value }) => ({
                  name,
                  value: value ?? '',
                })),
              setAll: (cookies, additionalHeaders) => {
                for (const { name, value, options } of cookies) {
                  setCookieStrings.push(serializeCookieHeader(name, value, options as Parameters<typeof serializeCookieHeader>[2]))
                }
                Object.assign(extraResponseHeaders, additionalHeaders)
              },
            },
          },
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        const destination = !error || isCodeReuseError(error) ? '/' : '/login'
        const headers = new Headers({ Location: destination })

        for (const cookie of setCookieStrings) {
          headers.append('Set-Cookie', cookie)
        }
        for (const [key, val] of Object.entries(extraResponseHeaders)) {
          headers.set(key, val)
        }

        return new Response(null, { status: 302, headers })
      },
    },
  },
})
```

- [ ] **Step 2: テストファイルの import を実装ファイルに切り替える**

`apps/pwa/tests/pages/api/auth/callback.test.ts` を以下に書き換える:

```ts
import { describe, it, expect } from 'vitest'
import { isCodeReuseError } from '@/pages/api/auth/callback'

describe('isCodeReuseError', () => {
  it('otp_expired を含むエラーメッセージを認識する', () => {
    expect(isCodeReuseError(new Error('otp_expired'))).toBe(true)
  })

  it('invalid_grant を含むエラーメッセージを認識する', () => {
    expect(isCodeReuseError(new Error('invalid_grant'))).toBe(true)
  })

  it('invalid request を含むエラーメッセージを認識する', () => {
    expect(isCodeReuseError(new Error('invalid request'))).toBe(true)
  })

  it('大文字小文字を区別しない', () => {
    expect(isCodeReuseError(new Error('OTP_EXPIRED'))).toBe(true)
  })

  it('文字列エラーも処理できる', () => {
    expect(isCodeReuseError('otp_expired error occurred')).toBe(true)
  })

  it('無関係なエラーは false を返す', () => {
    expect(isCodeReuseError(new Error('network error'))).toBe(false)
  })

  it('null/undefined は false を返す', () => {
    expect(isCodeReuseError(null)).toBe(false)
    expect(isCodeReuseError(undefined)).toBe(false)
  })
})
```

- [ ] **Step 3: テストが通ることを確認する**

```bash
cd apps/pwa && pnpm test -- --reporter=verbose tests/pages/api/auth/callback.test.ts
```

期待: 7 tests passed

---

### Task 3: `signInWithGoogle` の `redirectTo` を更新する

**Files:**
- Modify: `apps/pwa/src/shared/lib/auth.ts`

- [ ] **Step 1: `redirectTo` を変更する**

`apps/pwa/src/shared/lib/auth.ts` の `signInWithGoogle` 内:

```diff
-      redirectTo: `${window.location.origin}/auth/callback`,
+      redirectTo: `${window.location.origin}/api/auth/callback`,
```

変更後のファイル全体:

```ts
import { createServerFn } from '@tanstack/react-start'
import type { Database } from '@manna/database'

export async function signInWithGoogle() {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback`,
    },
  })
  if (error) throw error
}

export async function signOut() {
  const { supabase } = await import('./supabase')
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { supabase } = await import('./supabase')
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export async function createSupabaseServer() {
  const { createServerClient, parseCookieHeader } = await import('@supabase/ssr')
  const { getStartContext } = await import('@tanstack/start-storage-context')
  const cookieHeader = getStartContext()?.request?.headers.get('cookie') ?? ''
  return createServerClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_KEY,
    {
      cookies: {
        getAll: () =>
          parseCookieHeader(cookieHeader).map(({ name, value }) => ({
            name,
            value: value ?? '',
          })),
        setAll: () => {},
      },
    },
  )
}

export const getServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const serverSupabase = await createSupabaseServer()
  const {
    data: { session },
  } = await serverSupabase.auth.getSession()
  return session
})
```

---

### Task 4: 旧コールバックページを削除する

**Files:**
- Delete: `apps/pwa/src/pages/auth/callback.tsx`

- [ ] **Step 1: 旧ファイルを削除する**

```bash
rm apps/pwa/src/pages/auth/callback.tsx
```

- [ ] **Step 2: `auth/` ディレクトリが空なら削除する**

```bash
rmdir apps/pwa/src/pages/auth/ 2>/dev/null || true
```

- [ ] **Step 3: 全テストが通ることを確認する**

```bash
cd apps/pwa && pnpm test
```

期待: all tests passed（既存テストも含めて失敗なし）

---

### Task 5: コミットする

- [ ] **Step 1: 変更をステージして状態確認**

```bash
git status
git diff --staged
```

- [ ] **Step 2: コミット**

```bash
git add apps/pwa/src/pages/api/auth/callback.ts \
        apps/pwa/tests/pages/api/auth/callback.test.ts \
        apps/pwa/src/shared/lib/auth.ts
git rm apps/pwa/src/pages/auth/callback.tsx
git commit -m "$(cat <<'EOF'
refactor(auth): OAuth コールバックをサーバーサイドに移行 (#21)

useEffect によるクライアントサイドのコード交換を廃止し、
createFileRoute の server.handlers.GET でサーバー側で
exchangeCodeForSession を実行して Set-Cookie を確定させる。

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: コミット成功を確認**

```bash
git log --oneline -3
```
