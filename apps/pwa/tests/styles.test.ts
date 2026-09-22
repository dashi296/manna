import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse, type AtRule, type ChildNode, type Declaration, type Rule } from 'postcss'
import { describe, expect, it } from 'vitest'

// jsdom はスタイルシートを評価しない（@utility を含むこの CSS は CSSOM でも
// 解析できない）ので、カスケードの前提はソースの AST で確かめる
const root = parse(readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8'))

/** ネストの外側にある規則を取り出す。@layer や @utility の中のものは含まない */
function topLevel<T extends ChildNode>(label: string, match: (node: ChildNode) => node is T): T {
  const found = root.nodes.find(match)
  if (!found) throw new Error(`${label} がネストの外側に無い`)
  return found
}

const verseRowUtility = (node: ChildNode): node is AtRule =>
  node.type === 'atrule' && `@${node.name} ${node.params}` === '@utility verse-row'

const verseRowRule = (node: ChildNode): node is Rule =>
  node.type === 'rule' && node.selector === '.verse-row'

describe('verse-row のカスケード', () => {
  it('transition は @utility の外、かつどのレイヤーにも入れない', () => {
    // @utility は utilities レイヤーに入り、レイヤー外の button ルールに負ける。
    // 選択モードの行は button なので、レイヤーに入れた時点で読みモードと食い違う
    const inUtility: string[] = []
    topLevel('@utility verse-row', verseRowUtility).walkDecls('transition', (decl) => {
      inUtility.push(decl.value)
    })
    expect(inUtility).toEqual([])

    const declarations = topLevel('.verse-row', verseRowRule).nodes.filter(
      (node): node is Declaration => node.type === 'decl' && node.prop === 'transition',
    )
    expect(declarations.map((decl) => decl.value)).toEqual([
      'background-color 200ms, border-color 200ms',
    ])
  })

  it('強調は選択中には当たらない', () => {
    // 記述順ではなく排他条件で決める。順序で決めると並べ替えで黙って壊れる
    const selectors: string[] = []
    topLevel('@utility verse-row', verseRowUtility).walkRules((rule) => {
      selectors.push(rule.selector)
    })
    expect(selectors).toContain('&[data-highlighted]:not([data-selected])')
  })
})
