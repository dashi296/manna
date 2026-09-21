import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse, type AtRule, type Rule } from 'postcss'
import { describe, expect, it } from 'vitest'

// jsdom はスタイルシートを評価しない（@utility を含むこの CSS は CSSOM でも
// 解析できない）ので、カスケードの前提はソースの AST で確かめる
const root = parse(readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8'))

/** ネストの外側にある規則。@layer や @utility の中のものは含まない */
function topLevel<T extends Rule | AtRule>(match: (node: Rule | AtRule) => boolean): T {
  const found = root.nodes
    .filter((node): node is Rule | AtRule => node.type === 'rule' || node.type === 'atrule')
    .find(match)
  expect(found, 'ネストの外側に見つからない').toBeDefined()
  return found as T
}

describe('verse-row のカスケード', () => {
  const utility = () =>
    topLevel<AtRule>(
      (n) => n.type === 'atrule' && `@${n.name} ${n.params}` === '@utility verse-row',
    )

  it('transition は @utility の外、かつどのレイヤーにも入れない', () => {
    // @utility は utilities レイヤーに入り、レイヤー外の button ルールに負ける。
    // 選択モードの行は button なので、レイヤーに入れた時点で読みモードと食い違う
    let declared = false
    utility().walkDecls('transition', () => {
      declared = true
    })
    expect(declared, '@utility の中に transition がある').toBe(false)

    const rule = topLevel<Rule>((n) => n.type === 'rule' && n.selector === '.verse-row')
    const transition = rule.nodes.find((n) => n.type === 'decl' && n.prop === 'transition')
    expect(transition).toBeDefined()
    expect((transition as { value: string }).value).toBe(
      'background-color 200ms, border-color 200ms',
    )
  })

  it('強調は選択中には当たらない', () => {
    // 記述順ではなく排他条件で決める。順序で決めると並べ替えで黙って壊れる
    const selectors: string[] = []
    utility().walkRules((r) => {
      selectors.push(r.selector)
    })
    expect(selectors).toContain('&[data-highlighted]:not([data-selected])')
  })
})
