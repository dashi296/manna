// DOM の無い Workers でも動くよう、許可タグは固定文字列で出し直し、他のタグは外して残りをすべてエスケープする
// 名前の直後を名前に使えない文字に限り、`>` の無い長い入力でのバックトラックを避ける
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)(?:[^<>a-zA-Z0-9-][^<>]*)?>/g
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
