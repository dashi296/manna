# ロゴ刷新（SVG化・全面置き換え） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/pwa/assets/logo/logo_new.png`（新デザインのロゴ）をベクター化し、favicon・PWAアイコン・アプリ内ロゴ表示すべてを新ロゴに置き換える。

**Architecture:** 純粋なアセット差し替えタスク。コード（`LogoMark.tsx` など）はファイル名で静的アセットを参照するだけなので変更不要。`logo_new.png`（透過情報なし・チェッカー柄が焼き込み済み）→ 背景除去＋色レイヤー分離（Python/Pillow）→ `potrace` でベクタートレース → 現行 `logo-mark.svg` と同じ構造のSVGに手動結合 → そのSVGから各サイズのラスターPNG/ICOを再生成、という一方向パイプライン。

**Tech Stack:** Python3 + Pillow（背景除去・色分離）、ImageMagick (`magick`)、`potrace`（いずれもローカルにインストール済み・検証済み）

## Global Constraints

- 対象spec: [`docs/superpowers/specs/2026-07-23-logo-refresh-design.md`](../specs/2026-07-23-logo-refresh-design.md)
- コード変更なし。変更対象は `apps/pwa/public/` 配下のアセットと `apps/pwa/assets/logo/` のソースのみ
- 色: ネイビー `#0a2a4a`（`.ink`）、ゴールド `#fbb938`（`.grain`）。ダークモード（`prefers-color-scheme: dark`）では `.ink, .grain` とも `#fde2ba`（現行 `logo-mark.svg` と同じダークモード配色）に切り替え
- PWAアイコンの背景色は `manifest.json` の `background_color`（`#f6f3ee`）に合わせる。既存 `logo512.png` を計測したところコンテンツ幅は正方形キャンバスの約80%（余白約10%ずつ）— 新アイコンも同じ比率を踏襲する
- 各コマンドは `WORKDIR=$(mktemp -d)` で作った作業ディレクトリで実行し、最終成果物のみ `apps/pwa/` 配下にコピーする（中間ファイルはリポジトリにコミットしない）

---

### Task 1: 透過ソースPNGと色マスクの生成

**Files:**
- Create（作業ディレクトリ内、コミット対象外）: `$WORKDIR/transparent.png`, `$WORKDIR/navy_mask.png`, `$WORKDIR/gold_mask.png`

**Interfaces:**
- Consumes: `apps/pwa/assets/logo/logo_new.png`（1254x1254、RGB、透過なし）
- Produces: `$WORKDIR/transparent.png`（実際のアルファチャンネルを持つ、内容部分のみにトリムされたPNG。Task 2 がこれを元にベクター化する際の見た目確認用）、`$WORKDIR/navy_mask.png` / `$WORKDIR/gold_mask.png`（各色領域の2値マスク、Task 2 で potrace の入力にする）

- [ ] **Step 1: 作業ディレクトリを作成しスクリプトを書く**

```bash
WORKDIR=$(mktemp -d)
echo "$WORKDIR" > /tmp/manna-logo-workdir.txt
cat > "$WORKDIR/generate_masks.py" <<'PYEOF'
import sys
from PIL import Image

SRC = sys.argv[1]
OUTDIR = sys.argv[2]

im = Image.open(SRC).convert("RGB")
w, h = im.size
out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
navy_mask = Image.new("L", (w, h), 0)
gold_mask = Image.new("L", (w, h), 0)
px = im.load()
out_px = out.load()
navy_px = navy_mask.load()
gold_px = gold_mask.load()

for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        is_background = abs(r - g) < 12 and abs(g - b) < 12 and r > 215
        if is_background:
            continue
        if b > r and r < 100:
            navy_px[x, y] = 255
            out_px[x, y] = (r, g, b, 255)
        elif r > 200 and g > 130 and b < 150:
            gold_px[x, y] = 255
            out_px[x, y] = (r, g, b, 255)

bbox_navy = navy_mask.getbbox()
bbox_gold = gold_mask.getbbox()
bbox = (
    min(bbox_navy[0], bbox_gold[0]),
    min(bbox_navy[1], bbox_gold[1]),
    max(bbox_navy[2], bbox_gold[2]),
    max(bbox_navy[3], bbox_gold[3]),
)
pad = 20
bbox = (
    max(0, bbox[0] - pad),
    max(0, bbox[1] - pad),
    min(w, bbox[2] + pad),
    min(h, bbox[3] + pad),
)

out.crop(bbox).save(f"{OUTDIR}/transparent.png")
navy_mask.crop(bbox).save(f"{OUTDIR}/navy_mask.png")
gold_mask.crop(bbox).save(f"{OUTDIR}/gold_mask.png")
print("bbox:", bbox, "size:", bbox[2] - bbox[0], bbox[3] - bbox[1])
PYEOF
```

- [ ] **Step 2: スクリプトを実行する**

Run: `python3 "$WORKDIR/generate_masks.py" apps/pwa/assets/logo/logo_new.png "$WORKDIR"`

Expected: `bbox: (218, 258, 1036, 975) size: 818 717` が出力される

- [ ] **Step 3: 透過が正しく効いているか検証する**

Run:
```bash
python3 -c "
from PIL import Image
im = Image.open('$WORKDIR/transparent.png')
print('mode:', im.mode)
print('size:', im.size)
print('alpha extrema:', im.getchannel('A').getextrema())
"
```

Expected: `mode: RGBA`, `size: (818, 717)`, `alpha extrema: (0, 255)`（0と255の両方が存在＝透明部分と不透明部分が両方ある）

---

### Task 2: ベクター化して logo-mark.svg を生成・配置

**Files:**
- Create: `apps/pwa/public/logo-mark.svg`（上書き）

**Interfaces:**
- Consumes: Task 1 の `$WORKDIR/navy_mask.png`, `$WORKDIR/gold_mask.png`
- Produces: `apps/pwa/public/logo-mark.svg`（viewBox `0 0 818 717`、`.ink`/`.grain` クラス構成）。Task 3 がこのSVGをラスタライズして各アイコンを再生成する

- [ ] **Step 1: Task 1 の作業ディレクトリを復元し、マスクを反転してPBM化する**

Task 1 と別セッションで実行する場合に備え、`$WORKDIR` を保存済みのパスから復元する。potrace はデフォルトで「黒画素」を前景としてトレースするため、マスク（白=形状/黒=背景）は反転してから渡す。

Run:
```bash
WORKDIR=$(cat /tmp/manna-logo-workdir.txt)
magick "$WORKDIR/navy_mask.png" -negate "$WORKDIR/navy_mask_inv.pbm"
magick "$WORKDIR/gold_mask.png" -negate "$WORKDIR/gold_mask_inv.pbm"
```

Expected: エラーなく2つの `.pbm` ファイルが `$WORKDIR` に生成される

- [ ] **Step 2: potraceでベクタートレースする**

Run:
```bash
potrace "$WORKDIR/navy_mask_inv.pbm" -s -o "$WORKDIR/navy.svg" --flat
potrace "$WORKDIR/gold_mask_inv.pbm" -s -o "$WORKDIR/gold.svg" --flat
```

Expected: `$WORKDIR/navy.svg` と `$WORKDIR/gold.svg` が生成され、それぞれ単一の `<path d="...">` を含む（`grep -c '<path' "$WORKDIR/navy.svg"` が `1` を返す）

- [ ] **Step 3: 反転が正しい向きか目視確認する**

Run: `magick -background "#e0e0e0" "$WORKDIR/navy.svg" "$WORKDIR/navy_preview.png"` の上で `navy_preview.png` を読み、本の形（開いた本のシルエット）がグレー背景に対して塗りつぶされて見えることを確認する（枠全体が塗りつぶされ本の部分が穴になっていたら Step 1 の `-negate` が漏れている）。

- [ ] **Step 4: 最終SVGを組み立てて配置する**

`$WORKDIR/navy.svg` と `$WORKDIR/gold.svg` それぞれの `d="..."` の中身を抜き出し、以下の内容で `apps/pwa/public/logo-mark.svg` を上書きする（`d` 属性の値は各ファイルの実際のパスデータに置き換える。既に検証済みの値をそのまま使う場合は下記の通り）:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 818 717" role="img" aria-hidden="true">
  <style>
    .ink { fill: #0a2a4a; }
    .grain { fill: #fbb938; }
    @media (prefers-color-scheme: dark) {
      .ink, .grain { fill: #fde2ba; }
    }
  </style>
  <g transform="translate(0.000000,717.000000) scale(0.100000,-0.100000)">
    <g class="ink">
      <path d="M480 3991 c-14 -4 -31 -19 -38 -35 -12 -24 -12 -38 2 -94 29 -116 128 -457 135 -464 4 -4 63 -15 131 -23 282 -36 641 -123 880 -214 284 -107 582 -254 994 -490 127 -72 232 -129 234 -126 17 17 -145 248 -289 412 -456 519 -1272 959 -1914 1033 -99 11 -100 11 -135 1z M7508 3985 c-707 -115 -1499 -575 -1944 -1130 -113 -141 -215 -297 -202 -311 2 -2 87 44 188 102 733 420 1085 568 1610 679 92 19 394 65 430 65 12 0 25 40 91 275 63 226 72 286 48 311 -21 21 -123 25 -221 9z M298 3140 c-62 -33 -98 -103 -98 -190 0 -115 22 -190 248 -850 65 -188 88 -255 196 -554 67 -184 92 -200 356 -227 861 -88 1748 -341 2258 -643 142 -84 184 -125 206 -205 22 -79 65 -127 148 -169 267 -133 702 -131 961 5 79 42 120 87 137 152 27 98 77 145 277 255 521 287 1425 534 2233 609 162 15 210 33 254 90 41 54 448 1219 486 1392 40 183 15 286 -80 335 -73 37 -247 23 -550 -45 -418 -94 -744 -222 -1375 -538 -228 -114 -678 -327 -800 -379 -367 -157 -610 -293 -812 -454 -140 -112 -137 -104 -173 -454 -45 -439 -62 -560 -80 -560 -18 0 -46 202 -95 688 -9 84 -20 164 -25 177 -39 103 -359 323 -709 487 -58 28 -185 86 -281 130 -96 44 -403 192 -681 329 -579 284 -566 278 -798 370 -494 196 -1074 316 -1203 249z"/>
    </g>
    <g class="grain">
      <path d="M4276 6960 c-43 -13 -93 -67 -111 -118 -19 -58 -19 -167 1 -246 23 -92 115 -271 183 -356 146 -182 345 -290 464 -251 91 30 130 97 131 221 1 174 -103 394 -268 568 -78 82 -184 152 -265 176 -60 18 -91 19 -135 6z M4081 5485 c-204 -57 -417 -269 -513 -508 -30 -76 -32 -91 -33 -197 0 -127 13 -167 72 -221 52 -49 89 -61 173 -57 66 3 88 9 163 46 267 132 505 525 458 754 -15 71 -59 138 -109 166 -52 29 -141 36 -211 17z M4263 4236 c-61 -29 -97 -77 -114 -151 -34 -152 97 -415 271 -546 66 -49 186 -111 255 -130 70 -19 161 -17 217 4 153 59 170 258 41 471 -168 277 -480 440 -670 352z M3780 3573 c-277 -47 -511 -235 -510 -412 1 -78 65 -162 154 -202 144 -63 380 -45 564 44 82 39 198 150 230 219 57 123 1 244 -142 308 -92 42 -205 58 -296 43z M4635 3126 c-168 -39 -293 -104 -396 -206 -117 -116 -155 -221 -110 -307 23 -47 55 -72 138 -110 52 -24 73 -27 198 -31 161 -5 251 11 392 71 381 161 459 449 153 568 -71 28 -283 36 -375 15z M3037 2930 c-43 -24 -77 -73 -77 -112 0 -46 37 -130 84 -189 105 -133 360 -294 540 -339 106 -27 245 -27 303 -1 115 53 84 197 -77 361 -88 90 -174 152 -285 208 -128 64 -204 84 -335 88 -102 4 -119 2 -153 -16z"/>
    </g>
  </g>
</svg>
```

- [ ] **Step 5: ブラウザでの見た目を検証する**

Run: `magick -background "#f6f3ee" apps/pwa/public/logo-mark.svg "$WORKDIR/final_light.png"` の上で `final_light.png` を読み、本と実（コイン状の粒）がそれぞれネイビー・ゴールドで正しく表示されていることを確認する。

- [ ] **Step 6: コミット**

```bash
git add apps/pwa/public/logo-mark.svg
git commit -m "feat: logo-mark.svg を新ロゴ（開いた聖典モチーフ）に置き換え"
```

---

### Task 3: PWA/faviconラスターアイコンの再生成・配置

**Files:**
- Modify: `apps/pwa/public/logo192.png`, `apps/pwa/public/logo512.png`, `apps/pwa/public/apple-touch-icon.png`, `apps/pwa/public/favicon.ico`

**Interfaces:**
- Consumes: `apps/pwa/public/logo-mark.svg`（Task 2 で確定した最終SVG）
- Produces: 更新された4つのアイコンファイル。`manifest.json` や `__root.tsx` のファイル名参照は変更不要（同名で上書きするため）

- [ ] **Step 1: 作業ディレクトリを復元し、各サイズのアイコンを生成する**

コンテンツ幅はキャンバスの80%、背景色は `manifest.json` の `background_color`（`#f6f3ee`）に合わせる。

Run:
```bash
WORKDIR=$(cat /tmp/manna-logo-workdir.txt)
for SIZE in 512 192 180; do
  CW=$(python3 -c "print(round($SIZE*0.8))")
  magick -background none -density 600 apps/pwa/public/logo-mark.svg -resize "${CW}x" "$WORKDIR/render_$SIZE.png"
  magick -size ${SIZE}x${SIZE} canvas:"#f6f3ee" "$WORKDIR/render_$SIZE.png" -gravity center -composite -depth 8 "$WORKDIR/icon_$SIZE.png"
done
for SIZE in 16 32 48; do
  CW=$(python3 -c "print(round($SIZE*0.8))")
  magick -background none -density 600 apps/pwa/public/logo-mark.svg -resize "${CW}x" "$WORKDIR/render_f$SIZE.png"
  magick -size ${SIZE}x${SIZE} canvas:"#f6f3ee" "$WORKDIR/render_f$SIZE.png" -gravity center -composite -depth 8 "$WORKDIR/fav_$SIZE.png"
done
magick "$WORKDIR/fav_16.png" "$WORKDIR/fav_32.png" "$WORKDIR/fav_48.png" "$WORKDIR/favicon.ico"
```

Expected: `magick identify "$WORKDIR"/icon_*.png` が `icon_512.png` `icon_192.png` `icon_180.png` それぞれ指定サイズ・`8-bit` 深度で表示され（`-depth 8` を付けないとImageMagickのSVGレンダリング既定である16-bitのまま書き出され、視覚的な利得なくファイルサイズが約2倍になる）、`magick identify "$WORKDIR/favicon.ico"` が `16x16`, `32x32`, `48x48` の3エントリを表示する

- [ ] **Step 2: 生成物をpublicディレクトリに配置する**

```bash
cp "$WORKDIR/icon_512.png" apps/pwa/public/logo512.png
cp "$WORKDIR/icon_192.png" apps/pwa/public/logo192.png
cp "$WORKDIR/icon_180.png" apps/pwa/public/apple-touch-icon.png
cp "$WORKDIR/favicon.ico" apps/pwa/public/favicon.ico
```

- [ ] **Step 3: 差分を目視確認する**

`apps/pwa/public/logo512.png` を読み、新ロゴ（本と実）が中央に配置され背景が `#f6f3ee` で塗られていることを確認する。

- [ ] **Step 4: コミット**

```bash
git add apps/pwa/public/logo192.png apps/pwa/public/logo512.png apps/pwa/public/apple-touch-icon.png apps/pwa/public/favicon.ico
git commit -m "feat: PWAアイコン・faviconを新ロゴで再生成"
```

---

### Task 4: 旧アセットの整理

**Files:**
- Delete: `apps/pwa/assets/logo/logo_dark.png`, `apps/pwa/assets/logo/logo_light.png`
- Add: `apps/pwa/assets/logo/logo_new.png`（新ロゴの原本ソースとして残す。現時点でgit未管理のため新規追加する。将来再書き出しする際の参照用）

**Interfaces:**
- Consumes: なし（コードから直接参照されていないことは事前調査済み — `grep -rn "logo_dark\|logo_light" apps/pwa --include="*.ts" --include="*.tsx" --include="*.json"` がヒットなしであることを確認済み）
- Produces: なし（クリーンアップのみ）

- [ ] **Step 1: 念のため参照がないことを再確認する**

Run: `grep -rn "logo_dark\|logo_light" apps/pwa --include="*.ts" --include="*.tsx" --include="*.json" --include="*.html"`

Expected: 出力なし（ヒットなし）

- [ ] **Step 1.5: 新ロゴの原本ソースをgit管理下に追加する**

Run: `git status --short apps/pwa/assets/logo/logo_new.png` で `??`（未追跡）になっていることを確認したうえで、`git add apps/pwa/assets/logo/logo_new.png` を実行する（この時点ではまだコミットしない。Step 3 でまとめてコミットする）

- [ ] **Step 2: 旧アセットを削除する**

```bash
git rm apps/pwa/assets/logo/logo_dark.png apps/pwa/assets/logo/logo_light.png
```

- [ ] **Step 3: コミット**

```bash
git commit -m "chore: ロゴ原本ソースを新ロゴに入れ替え"
```

---

### Task 5: 実機検証

**Files:**
- なし（検証のみ、コード変更なし）

**Interfaces:**
- Consumes: Task 2〜4 で確定した全アセット
- Produces: なし

- [ ] **Step 1: `verify` スキルの手順に従いローカル環境を起動する**

`verify` スキル（Manna PWA のローカル実機検証手順）を使い、ローカルSupabase + Vite dev サーバーを起動する。

- [ ] **Step 2: サイドバーのロゴを確認する**

Playwright等でログイン後の画面を開き、`AppSidebar.tsx` の `LogoMark`（`size-7`）が新ロゴで表示されていることをスクリーンショットで確認する。

- [ ] **Step 3: ログイン画面のロゴを確認する**

`/login` を開き、`LogoMark`（`size-16`）が新ロゴで表示されていることを確認する。

- [ ] **Step 4: faviconを確認する**

ブラウザタブのfaviconが新ロゴになっていることを確認する（`logo-mark.svg` が `rel="icon"` として使われる）。

- [ ] **Step 5: PWAインストールバナーを確認する**

`InstallPwaBanner.tsx` が表示される状態（初回訪問）を再現し、`logo192.png` が新ロゴで表示されることを確認する。

- [ ] **Step 6: ダークモードでの視認性を確認する**

OS/ブラウザの `prefers-color-scheme` を `dark` に切り替え、`logo-mark.svg` の本の輪郭（`.ink`）が暗い背景でも `#fde2ba` に切り替わり視認できることを確認する。

- [ ] **Step 7: 作業ディレクトリを片付ける**

```bash
rm -rf "$(cat /tmp/manna-logo-workdir.txt)" /tmp/manna-logo-workdir.txt
```
