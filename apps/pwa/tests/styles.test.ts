import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// jsdom はスタイルシートを評価しないので（@utility を含むこの CSS は
// CSSOM でも解析できない）、カスケードの前提はソースで確かめるしかない。
// 文字列一致だと整形で落ちるため、深さを数えて規則を取り出す

type Rule = { prelude: string; body: string }

/**
 * コメントと文字列の中身を落とす。正規表現で順に消すと、文字列内の `/*` を
 * コメント開始と取り違えたり、エスケープされた改行で行がずれたりする
 */
function strip(source: string): string {
  let out = ''
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end === -1 ? source.length : end + 1
      out += ' '
    } else if (char === '"' || char === "'") {
      i++
      while (i < source.length && source[i] !== char) i += source[i] === '\\' ? 2 : 1
      out += '""'
    } else if (char === '\\') {
      // セレクタ内のエスケープ（`.foo\{bar` など）を構造として数えないため
      out += ' '
      i++
    } else {
      out += char
    }
  }
  return out
}

/** ネストの外側にある規則だけを返す。@layer や @utility の中のものは含めない */
function topLevelRules(source: string): Rule[] {
  const css = strip(source)
  const rules: Rule[] = []
  let preludeStart = 0
  let bodyStart = 0
  let depth = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      if (depth === 0) bodyStart = i + 1
      depth++
    } else if (css[i] === '}') {
      depth--
      if (depth === 0) {
        rules.push({
          prelude: css.slice(preludeStart, bodyStart - 1).trim(),
          body: css.slice(bodyStart, i),
        })
        preludeStart = i + 1
      }
    }
  }
  return rules
}

describe('CSS の走査', () => {
  const preludes = (css: string) => topLevelRules(css).map((r) => r.prelude)

  it('コメント内の波括弧を数えない', () => {
    expect(preludes('.a { /* } */ color: red; }\n.b { color: red; }')).toEqual(['.a', '.b'])
  })

  it('文字列内のコメント記号をコメントの始まりとして扱わない', () => {
    expect(preludes('.a { content: "/*"; }\n/* c */\n.b { color: red; }')).toEqual(['.a', '.b'])
  })

  it('文字列内のエスケープ改行で崩れない', () => {
    expect(preludes('.a { content: "x\\\n}more"; }\n.b { color: red; }')).toEqual(['.a', '.b'])
  })

  it('セレクタ内のエスケープされた波括弧を数えない', () => {
    expect(preludes('.foo\\{bar { color: red; }\n.b { color: red; }')).toHaveLength(2)
  })

  it('at-rule の中の規則はトップレベルに含めない', () => {
    expect(preludes('@layer base {\n.a { color: red; }\n}')).toEqual(['@layer base'])
  })
})

describe('verse-row のカスケード', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

  function rule(prelude: string): string {
    const found = topLevelRules(css).find((r) => r.prelude === prelude)
    expect(found, `${prelude} がネストの外側に無い`).toBeDefined()
    return found!.body
  }

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
