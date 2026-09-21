import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// jsdom はスタイルシートを評価しないので、カスケードの前提はソースで確かめるしかない。
// ここで見ているのは、壊れても画面にしか出ず、他のテストが素通りする2点
const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

function block(header: string): string {
  const start = css.indexOf(header)
  expect(start, `${header} が見つからない`).toBeGreaterThan(-1)
  let depth = 0
  for (let i = start + header.length - 1; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1)
  }
  throw new Error(`${header} の括弧が閉じていない`)
}

describe('verse-row のカスケード', () => {
  it('transition を @utility の外に置く', () => {
    // @utility は utilities レイヤーに入り、レイヤー外の button ルールに負ける。
    // 選択モードの行は button なので、中に戻すと読みモードと時間もプロパティも食い違う
    expect(block('@utility verse-row {')).not.toContain('transition')
    expect(css).toMatch(
      /^\.verse-row \{\n\s*transition: background-color 200ms, border-color 200ms;/m,
    )
  })

  it('強調は選択中には当たらない', () => {
    // 記述順ではなく排他条件で決める。順序で決めると並べ替えで黙って壊れる
    expect(block('@utility verse-row {')).toContain('&[data-highlighted]:not([data-selected])')
  })
})
