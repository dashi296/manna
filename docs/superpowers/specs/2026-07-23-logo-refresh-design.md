# ロゴ刷新（SVG化・全面置き換え） 設計

**作成日:** 2026-07-23
**対象:** Manna PWA（アセット差し替え、コード変更なし）

## 背景と目的

`apps/pwa/assets/logo/logo_new.png` に新デザインのロゴ（開いた聖典に実／コインがこぼれ落ちるモチーフ）が配置された。現行ロゴ（碗にマナがこぼれ落ちるモチーフ）を新ロゴに全面的に置き換え、SVG化してベクター資産として使えるようにする。

`logo_new.png` はアルファチャンネルを持たず、透過を示すチェッカー柄がそのままピクセルとして焼き込まれている（`mode: RGB`, alpha 常に 255）。ベクター化の前処理としてこの背景を色閾値で除去する必要がある。

## 現状の構成（変更対象）

| ファイル | 用途 |
|---|---|
| `apps/pwa/public/logo-mark.svg` | favicon（`__root.tsx`）、`LogoMark` コンポーネント（`AppSidebar.tsx` サイドバー、`login.tsx` ログイン画面）が参照する手描きベクターSVG。`prefers-color-scheme: dark` で色を切り替え |
| `apps/pwa/public/logo192.png`, `logo512.png` | `manifest.json` の PWA アイコン、`InstallPwaBanner.tsx` |
| `apps/pwa/public/apple-touch-icon.png` | iOS ホーム画面アイコン |
| `apps/pwa/public/favicon.ico` | フォールバックfavicon |
| `apps/pwa/assets/logo/logo_dark.png`, `logo_light.png` | 旧ロゴ（碗モチーフ）のソースアセット。コードから直接参照されていない |

`LogoMark.tsx` 等はファイル名で静的アセットを参照するのみで、**コード変更は不要**。純粋なアセット差し替えタスク。

## 変換パイプライン

1. **背景除去**: `logo_new.png` の各ピクセルについて、R≈G≈B かつ明度が高い（チェッカー柄の淡いグレー系）ものを背景と判定し除外
2. **色レイヤー分離**: 残りのピクセルをネイビー（本体、`#0a2a4a` 系）とゴールド（実／コイン、`#fbb938` 系）の2つの2値マスクに分離
3. **ベクター化**: 各マスクを `potrace` でトレースしパスデータを取得（検証済み、原画に忠実な滑らかな結果が得られている）
4. **SVG結合**: 現行 `logo-mark.svg` と同じ構造で1ファイルに統合
   - `.ink`（本体=ネイビー）／`.grain`（実=ゴールド）のクラス構成を踏襲
   - `@media (prefers-color-scheme: dark)` で `.ink` を淡いゴールド系に切り替え（現行と同じ方針＝暗い背景でも本の輪郭が沈まないようにする）
   - viewBox は余白をトリムして整形
5. **ラスター書き出し**: 透過処理済みの新ロゴから `logo192.png`／`logo512.png`／`apple-touch-icon.png`（180x180）／`favicon.ico` を再生成

## 成果物

- 置き換え: `apps/pwa/public/logo-mark.svg`, `logo192.png`, `logo512.png`, `apple-touch-icon.png`, `favicon.ico`
- 削除: `apps/pwa/assets/logo/logo_dark.png`, `logo_light.png`（旧ロゴの碗モチーフソース、コード参照なし）
- 保持: `apps/pwa/assets/logo/logo_new.png`（新ロゴの原本ソースとして残す）

## 検証

コード変更を伴わないため自動テストの追加対象はない。`verify` スキルの手順（ローカルSupabase + Vite dev + Playwright）で以下を目視確認する:

- サイドバーの `LogoMark`（`AppSidebar.tsx`）
- ログイン画面の `LogoMark`（`login.tsx`）
- ブラウザタブの favicon
- PWAインストールバナー（`InstallPwaBanner.tsx`）に表示される `logo192.png`
- OS の light/dark 設定を切り替えてロゴの視認性を確認

## スコープ外

- `manifest.json` の `theme_color`/`background_color` などブランドカラーの見直し（今回はロゴ画像のみ）
- Service Worker のアイコンキャッシュ更新戦略（既存の仕組みをそのまま利用）
