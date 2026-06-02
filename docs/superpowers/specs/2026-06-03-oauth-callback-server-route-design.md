# OAuth コールバック サーバールート移行 設計書

## 背景

現在の `/auth/callback` は `useEffect` でブラウザ側から `exchangeCodeForSession()` を呼ぶため、hydration 後まで白画面が発生し、SSR でセッションが確定しない問題がある。

## 目標

OAuth コード交換をサーバーサイドに移し、Set-Cookie ヘッダーでセッションを確立する。

## アーキテクチャ

```
Google OAuth
  → /api/auth/callback?code=...  (新サーバールート)
  → createServerClient で exchangeCodeForSession
  → Set-Cookie + Location: /  (302リダイレクト)
```

## 変更ファイル

| 操作 | パス |
|---|---|
| 新規作成 | `apps/pwa/src/pages/api/auth/callback.ts` |
| 変更 | `apps/pwa/src/shared/lib/auth.ts` |
| 削除 | `apps/pwa/src/pages/auth/callback.tsx` |

## 実装詳細

### `pages/api/auth/callback.ts`

`createFileRoute('/api/auth/callback')` の `server.handlers.GET` を実装する。

```ts
GET: async ({ request }) => {
  const code = new URL(request.url).searchParams.get('code')
  if (!code) return redirect('/')

  const cookiesToSet: CookieEntry[] = []
  const extraHeaders: Record<string, string> = {}

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => parseCookieHeader(request.headers.get('cookie') ?? ''),
      setAll: (cookies, headers) => {
        cookiesToSet.push(...cookies)
        Object.assign(extraHeaders, headers)
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  const headers = new Headers({ Location: isCodeReuseError(error) || !error ? '/' : '/login' })
  for (const { name, value, options } of cookiesToSet) {
    headers.append('Set-Cookie', serializeCookieHeader(name, value, options))
  }
  for (const [k, v] of Object.entries(extraHeaders)) {
    headers.set(k, v)
  }
  return new Response(null, { status: 302, headers })
}
```

### `shared/lib/auth.ts`

`signInWithGoogle` の `redirectTo` を `/auth/callback` → `/api/auth/callback` に変更。

## エラーハンドリング

| 条件 | リダイレクト先 |
|---|---|
| `code` パラメータなし | `/` |
| `otp_expired` / `invalid_grant` / `invalid request` | `/` (再利用エラー = 認証済み) |
| その他エラー | `/login` |
| 成功 | `/` |
