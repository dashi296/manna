import scripturesData from '@/shared/config/scriptures.json'

export type ScriptureRef = {
  collection: string
  book: string
  chapter?: number
  verses?: number[]
}

export function buildScriptureUrl(ref: ScriptureRef): string {
  const base = 'https://www.churchofjesuschrist.org/study/scriptures'
  let url = `${base}/${ref.collection}/${ref.book}/${ref.chapter}?lang=jpn`
  const first = ref.verses ? [...ref.verses].sort((a, b) => a - b)[0] : undefined
  if (first) url += `&id=p${first}`
  return url
}

export function getScriptureLabel(ref: ScriptureRef): string {
  const collection = scripturesData.collections.find((c) => c.id === ref.collection)
  const book = collection?.books.find((b) => b.id === ref.book)
  const bookName = book?.name ?? ref.book
  if (!ref.chapter) return bookName
  if (!ref.verses?.length) return `${bookName} 第${ref.chapter}章`
  const sorted = [...ref.verses].sort((a, b) => a - b)
  if (sorted.length === 1) return `${bookName} ${ref.chapter}:${sorted[0]}`
  const isConsecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)
  if (isConsecutive) return `${bookName} ${ref.chapter}:${sorted[0]}–${sorted[sorted.length - 1]}`
  return `${bookName} ${ref.chapter}:${sorted.join(', ')}`
}
