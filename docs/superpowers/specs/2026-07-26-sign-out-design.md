# ログアウト導線の追加 設計

- Issue: #72

## 背景

`signOut()` は `apps/pwa/src/shared/lib/auth.ts:17` に実装済みだが、**呼び出す UI が存在しない**。一度ログインするとアプリ内からログアウトできない。この機能が解決するのは、この「通常のログアウト導線が無い」ことである。

なお、ローカル開発で DB をリセットするとセッション cookie だけが残り、`public.users` の行が無いためプロフィールページが 404 になる状況がある。この機能はその状態からの復帰は解決しない。プロフィールページは行が無いと `notFound()` を投げるが、`notFoundComponent` はアプリ内に一つも定義されておらず `ProfilePage` 自体が描画されないため、ログアウトボタンに到達できない。この復帰手段は別途対応する。

## スコープ

**含む**: 自分のプロフィールページへのログアウトボタンと確認シートの追加。

**含まない**: アカウント削除、他のデバイスからのログアウト、設定画面の新設。

## 配置

`apps/pwa/src/pages/profile/$userId/index.tsx` に、**自分のプロフィールを見ているときだけ**表示する。

現在この位置は他人のプロフィールのときだけボタンが出て、自分のときは空いている。

```tsx
{currentUserId && currentUserId !== profile.id && (
  <div className="flex gap-2 mt-3">
    <FollowButton ... />
    <FamilyButton ... />
  </div>
)}
```

ここに `currentUserId === profile.id` の分岐を足す。

### なぜサイドバーではないか

モバイルではサイドバーが表示されない（`AppSidebar` は `lg:` 以上でのみ表示、`BottomNav` は `lg:hidden`）。サイドバーのフッターにはアバターと表示名があるが、そこに置くとモバイルから到達できない。

プロフィールページは `NAV_ITEMS`（`shared/config/navigation.ts`）に含まれ、サイドバーとボトムナビの両方から到達できる唯一の場所である。

## 新規スライス

ログアウトはユーザー操作なので FSD 上 `features/` に置く。既存の `follow-user` / `manage-family` と同じ構成にする。

```
apps/pwa/src/features/sign-out/
  index.ts                 ← export { SignOutButton }
  ui/SignOutButton.tsx
```

`SignOutButton` がシートの開閉状態・処理中状態・確認シート・遷移をすべて内包する。プロフィールページ側は1行置くだけにする。props は不要。

## 確認シート

既存の `Sheet`（`apps/pwa/src/shared/ui/sheet.tsx`）を `side="bottom"` で使う。`Sheet` / `SheetContent` / `SheetHeader` / `SheetTitle` / `SheetDescription` / `SheetFooter` / `SheetClose` はすべて export 済み。

専用の AlertDialog は追加しない。このアプリの確認的なやり取り（`IosInstallInstructionsDialog`、`PostComposerSheet`、`VerseCommentSheet`）はすべて Sheet で行われており、消費者1つのために新規プリミティブを増やさない。破壊的操作の確認が2つ目に現れた時点で AlertDialog の導入を検討する。

`SheetTitle` / `SheetDescription` を使うため、スクリーンリーダーには見出しと説明が正しく伝わる。

| 要素 | 内容 |
|---|---|
| タイトル | ログアウトしますか？ |
| 説明 | 再度 Google でサインインすればまた利用できます |
| 実行ボタン | ログアウト（`variant="destructive"`） |
| 取消ボタン | キャンセル（`SheetClose` 経由、`variant="outline"`） |

## 処理の流れ

1. ボタン押下 → シートを開く
2. シート内の「ログアウト」押下 → `signOut()` を呼ぶ
3. 成功したら `window.location.href = '/login'`

### なぜ `useNavigate` ではなく全体リロードか

`signOut()` はクライアント側の Supabase セッションを消すが、SSR 側は cookie を読んで認証を判定する（`__root.tsx` の `beforeLoad` が `getServerSession()` を使う）。クライアントルーティングだけだと、サーバー側が古い cookie を見て認証済みと判定する可能性がある。全体リロードにすれば cookie が消えた状態で確実にやり直せる。

## エラー処理

`signOut()` は失敗時に throw する（`auth.ts:20` の `if (error) throw error`）。

既存の `useSupabaseAction`（`shared/lib/useSupabaseAction.ts`）は `{ error }` を返すアクションが前提で、throw する関数には合わないため使わない。`try/catch` で受け、**シートを開いたまま処理中状態を解除してボタンを再度押せるようにする**。

トーストの仕組みがアプリに存在しないため、それ以上の通知は行わない（一覧の「もっと見る」失敗時と同じ方針）。

## テスト（TDD）

### `apps/pwa/tests/features/sign-out/SignOutButton.test.tsx`（新規）

1. ボタンを押すと確認シートが表示される
2. 「キャンセル」でシートが閉じ、`signOut` が呼ばれない
3. 「ログアウト」で `signOut` が呼ばれる
4. `signOut` が失敗しても、ボタンを再度押せる状態に戻る

`signOut` は `@/shared/lib/auth` を `vi.mock` して差し替える。遷移は `window.location.href` への代入なので、jsdom では実際の遷移が起きない。代入されたことを検証するかは実装時に判断する（jsdom が "Not implemented: navigation" を出す場合は、遷移部分を関数に切り出してモックする）。

### `apps/pwa/tests/pages/profile/index.test.tsx`（既存に追加）

5. 自分のプロフィールではログアウトボタンが表示される（`currentUserId === profile.id`）
6. 他人のプロフィールでは表示されない
