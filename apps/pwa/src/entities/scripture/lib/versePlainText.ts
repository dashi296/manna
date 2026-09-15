// text_html にはルビが入っている。剥がさずに textContent を取ると
// 「漢字かんじ」と二重に出る。innerHTML は使わず DOMParser で解析する
// （ブラウザ専用。SSR には DOM が無いのでイベントハンドラからのみ呼ぶ）
export function verseHtmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const el of doc.querySelectorAll('rt, rp')) el.remove()
  return doc.body.textContent?.trim() ?? ''
}
