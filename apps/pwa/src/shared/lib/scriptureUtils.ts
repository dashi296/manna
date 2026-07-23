import scripturesData from '@/shared/config/scriptures.json'

export type ScriptureRef = {
  collection: string
  book: string
  chapter?: number
  verses?: number[]
}

export function findCollection(collectionId: string) {
  return scripturesData.collections.find((c) => c.id === collectionId)
}

export function findBook(ref: ScriptureRef) {
  return findCollection(ref.collection)?.books.find((b) => b.id === ref.book)
}

type ScriptureBook = ReturnType<typeof findBook>

export function buildScriptureUrl(ref: ScriptureRef, book: ScriptureBook = findBook(ref)): string {
  const base = 'https://www.churchofjesuschrist.org/study/scriptures'
  const chapterSegment = book?.isFrontMatter ? '' : `/${ref.chapter}`
  let url = `${base}/${ref.collection}/${ref.book}${chapterSegment}?lang=jpn`
  const first = ref.verses ? [...ref.verses].sort((a, b) => a - b)[0] : undefined
  if (first) url += `&id=p${first}`
  return url
}

export function getScriptureLabel(ref: ScriptureRef, book: ScriptureBook = findBook(ref)): string {
  const bookName = book?.name ?? ref.book
  if (!ref.chapter) return bookName
  if (!ref.verses?.length) {
    return book?.isFrontMatter ? bookName : `${bookName} 第${ref.chapter}章`
  }
  const sorted = [...ref.verses].sort((a, b) => a - b)
  if (sorted.length === 1) return `${bookName} ${ref.chapter}:${sorted[0]}`
  const isConsecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)
  if (isConsecutive) return `${bookName} ${ref.chapter}:${sorted[0]}–${sorted[sorted.length - 1]}`
  return `${bookName} ${ref.chapter}:${sorted.join(', ')}`
}
