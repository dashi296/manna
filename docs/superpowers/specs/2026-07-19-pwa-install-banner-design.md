# PWA インストール導線 設計

**作成日:** 2026-07-19
**対象:** Manna PWA（Phase 1 継続改善）

## 背景と目的

`public/manifest.json`・`apple-touch-icon`・`theme-color` は既に設定済みだが、以下が欠けているため、実際にはユーザーがアプリを「ホーム画面に追加」できる導線がない:

1. Service Worker が未登録 — Chromium は SW が動いていないと `beforeinstallprompt` を発火させないため、Android/デスクトップ Chrome のインストール基準を満たしていない
2. インストールを促す UI がない — インストールが可能な環境でも、ユーザーはブラウザメニューから自発的に「アプリをインストール」を探す必要がある。iOS Safari には自動プロンプトがないため、なおさら気づかれにくい

初回訪問時に軽いバナーを出し、Android Chrome ではネイティブプロンプト、iOS Safari では「ホーム画面に追加」の手順を案内する。

## 全体像

3 層構成:

| 層 | 追加物 | 役割 |
|---|---|---|
| public 静的 | `apps/pwa/public/sw.js` | Chromium のインストール基準を満たすためだけの最低限 Service Worker（fetch ハンドラなし） |
| shared/lib | `shared/lib/pwa/` | SW 登録関数と、環境・インストール状態の判定関数 |
| shared/ui | `shared/ui/InstallPwaBanner/` | 画面下部固定バナー + iOS 向け手順モーダル |

`__root.tsx` の `RootLayout` に組み込み、認証ページ（`/login`, `/auth/*`）では非表示。

## Service Worker

`apps/pwa/public/sw.js`（約 10 行）:

```javascript
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
```

- fetch ハンドラは意図的に置かない（キャッシュ戦略・オフライン対応は本設計のスコープ外）
- Chromium の「インストール可能」基準は満たす（HTTPS + manifest + アイコン + SW）

登録は `shared/lib/pwa/register-sw.ts` のヘルパー関数で行う:

```typescript
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // 登録失敗は静かに諦める（開発用 http 環境等）
  })
}
```

## 環境判定（`shared/lib/pwa/install-detection.ts`）

```typescript
export function isStandalone(): boolean
export function isIosSafari(): boolean
export function isRecentlyDismissed(now?: number): boolean
```

- `isStandalone`: `window.matchMedia('(display-mode: standalone)').matches` または `(navigator as any).standalone === true`
- `isIosSafari`: UA から iPhone/iPad Safari を検出（Chrome iOS = `CriOS`、Firefox iOS = `FxiOS` は除外）
- `isRecentlyDismissed`: `localStorage['manna:pwa-install-dismissed-at']` を読み、7 日以内なら true

判定は「なぜバナーが出ないか」をログしやすいよう、`shouldShowBanner` のような合成関数ではなく個別の boolean で公開する。バナーコンポーネント側でロジックを組み立てる。

## バナー UI（`shared/ui/InstallPwaBanner/`）

**コンポーネント構成:**

- `InstallPwaBanner.tsx` — メインコンポーネント（クライアント）
- `IosInstallInstructionsDialog.tsx` — iOS 用の手順モーダル（Base UI の `Dialog`）
- `index.ts` — パブリック API

**表示条件（AND 全部満たす）:**

- SSR ではない（`typeof window !== 'undefined'`）
- `!isStandalone()` — 既にインストール済みでない
- `!isRecentlyDismissed()` — 7 日以内に閉じていない
- 次のいずれか:
  - `beforeinstallprompt` を捕捉できている（Chromium）
  - `isIosSafari()` が true

**バナーの見た目:**

- 画面下部固定（`BottomNav` の直上、モバイルのみ表示 = `lg:hidden`）
- 高さ 56px 程度、`bg-background` + 上ボーダー
- 左: 32px のアプリアイコン + 「アプリとして追加」タイトル + 「ホーム画面から素早く開けます」の説明文（小さめ）
- 右: 「追加」ボタン（primary）+ 閉じる `×` アイコンボタン

**操作:**

- 「追加」ボタン:
  - Chromium: `deferredPrompt.prompt()` → `userChoice` の解決を待つ。`accepted` なら永久非表示（dismiss と同じ扱いで OK。インストール後は `isStandalone` が true になるため実質不要だが安全側）
  - iOS Safari: `IosInstallInstructionsDialog` を開く
- `×`: `localStorage.setItem('manna:pwa-install-dismissed-at', String(Date.now()))` → 非表示

**iOS 手順モーダル:**

- タイトル: 「ホーム画面に追加」
- 手順:
  1. 画面下部の「共有」ボタン（□↑ のアイコン）をタップ
  2. 「ホーム画面に追加」を選択
  3. 右上の「追加」をタップ
- 共有ボタンのアイコンは inline SVG で表現（画像アセット追加は避ける）
- Base UI の `Dialog` を使用

## SW 登録のタイミング

`InstallPwaBanner` の `useEffect` 内で `registerServiceWorker()` を呼ぶ。理由:

- SW 登録はインストール導線機能の一部（Chrome の `beforeinstallprompt` 発火に必須）
- 別コンポーネント化してもマウント順の考慮が要るだけ。凝集度重視で同じコンポーネントに寄せる
- 認証ページでは `InstallPwaBanner` を出さない = SW 登録もされない、で問題ない（ログイン後の遷移でどのみち登録される）

## `__root.tsx` への配置

```tsx
function RootLayout() {
  // ...
  if (isAuthPage) return <Outlet />

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <AppSidebar />
        <SidebarInset className="flex flex-col min-h-screen min-w-0">
          <main className="flex-1 pb-16 lg:pb-0">
            <div className="max-w-md mx-auto">
              <Outlet />
            </div>
          </main>
          <InstallPwaBanner />  {/* ← 追加。BottomNav より上に描画 */}
          <BottomNav />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
```

`fixed` 配置なので DOM 順は視覚順に関係ないが、`BottomNav` に対する `bottom` オフセット計算を素直にするため直前に置く。

## エラーハンドリング / エッジケース

- SW 登録失敗（HTTPS ではない localhost 以外の環境など）→ サイレントに諦める。Chromium で `beforeinstallprompt` が来ないので自然にバナーが出ない
- `deferredPrompt.prompt()` は 1 回しか呼べない仕様。呼び出し後は state を null にし、バナー自体も閉じる
- `appinstalled` イベントを捕捉して、明示的にバナー閉じ + dismissed_at 保存も行う（`prompt()` 経由でなくブラウザメニューからインストールされたケース）
- iOS の standalone 判定は `(navigator as any).standalone`。TypeScript の型に無いので `unknown` 経由でキャスト
- SSR 時 `null` を返す（早期リターン）

## テスト

- `apps/pwa/tests/shared/lib/pwa/install-detection.test.ts`:
  - `isRecentlyDismissed` の 7 日境界（今 / 7 日前ちょうど / 8 日前）
  - `localStorage` に値がなければ false
- `apps/pwa/tests/shared/ui/InstallPwaBanner.test.tsx`:
  - Chromium 経路: `beforeinstallprompt` を発火させるとバナーが表示される
  - iOS 経路: UA を iPhone Safari にモックしてバナーが表示される
  - standalone: 表示されない
  - 7 日以内 dismiss 済み: 表示されない
  - `×` タップで消え、`localStorage` に `dismissed-at` が入る
  - Chromium で「追加」タップ時に `deferredPrompt.prompt()` が呼ばれる
  - iOS で「追加」タップ時にモーダルが開く

`__root.tsx` への統合テストは既存のパターンに従わないので追加しない（既存も root のテストは書いていない）。

## スコープ外

- オフラインキャッシュ / precache
- push 通知
- update-available バナー（新しい SW がある通知）

これらは将来のスコープ。今回の SW は空のスタブ。

## 移行 / リリース時の注意

- `sw.js` を一度公開すると各ブラウザにキャッシュされる。将来 SW を拡張する際は、必ず `install` イベントで `skipWaiting()` + `activate` で `clients.claim()` を継続する（本設計のスタブと同じ挙動）ようにして、更新の詰まりを防ぐ
- manifest 変更時にアイコンが古いままになるケースがあるが、今回 manifest には触らない
