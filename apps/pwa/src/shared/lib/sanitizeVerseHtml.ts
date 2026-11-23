// 聖典本文の text_html に許すのは属性なしの ruby / rb / rt だけ。サーバー（Workers）には
// DOM が無いので、DOM を使わずに解析する。許可タグは固定の文字列で出し直し、他のタグは外し、
// 残りの文字はすべてエスケープするので、入力がどう壊れていても許可外の要素や属性は作られない
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)[^<>]*>/g
const ALLOWED = new Set(['ruby', 'rb', 'rt'])

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function sanitizeVerseHtml(html: string): string {
  let out = ''
  let last = 0
  const open: string[] = []
  for (const match of html.matchAll(TAG)) {
    out += escapeText(html.slice(last, match.index))
    last = match.index + match[0].length
    const closing = match[1] === '/'
    const tag = match[2].toLowerCase()
    if (!ALLOWED.has(tag)) continue
    if (!closing) {
      open.push(tag)
      out += `<${tag}>`
    } else if (open.at(-1) === tag) {
      open.pop()
      out += `</${tag}>`
    }
  }
  out += escapeText(html.slice(last))
  // 閉じ忘れを残すと、ブラウザが後ろの兄弟まで ruby の中として解釈しうる
  while (open.length > 0) out += `</${open.pop()}>`
  return out
}
