import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// jsdom はスタイルシートを評価しないので、カスケードの前提はソースで確かめるしかない。
// 文字列一致だと整形で落ちるうえ、コメント内の波括弧で数え違える。CSS パーサは
// 依存に無いので、コメントと文字列を落としてから深さだけ追う
const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

function stripNoise(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""')
}

/** ネストの外側（どの @layer にも @utility にも入っていない）にある規則だけを返す */
function topLevelRules(source: string): { prelude: string; body: string }[] {
  const clean = stripNoise(source)
  const rules: { prelude: string; body: string }[] = []
  let preludeStart = 0
  let depth = 0
  let bodyStart = 0
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '{') {
      if (depth === 0) bodyStart = i + 1
      depth++
    } else if (clean[i] === '}') {
      depth--
      if (depth === 0) {
        rules.push({
          prelude: clean.slice(preludeStart, bodyStart - 1).trim(),
          body: clean.slice(bodyStart, i),
        })
        preludeStart = i + 1
      }
    }
  }
  return rules
}

function rule(prelude: string): string {
  const found = topLevelRules(css).find((r) => r.prelude === prelude)
  expect(found, `${prelude} がネストの外側に無い`).toBeDefined()
  return found!.body
}

describe('verse-row のカスケード', () => {
  it('transition は @utility の外、かつどのレイヤーにも入れない', () => {
    // @utility は utilities レイヤーに入り、レイヤー外の button ルールに負ける。
    // 選択モードの行は button なので、レイヤーに入れた時点で読みモードと食い違う
    expect(rule('@utility verse-row')).not.toContain('transition')
    expect(rule('.verse-row')).toMatch(/transition:\s*background-color 200ms,\s*border-color 200ms/)
  })

  it('強調は選択中には当たらない', () => {
    // 記述順ではなく排他条件で決める。順序で決めると並べ替えで黙って壊れる
    expect(rule('@utility verse-row')).toContain('&[data-highlighted]:not([data-selected])')
  })
})
