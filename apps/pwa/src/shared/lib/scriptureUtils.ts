import scripturesData from '@/shared/config/scriptures.json'

// JSON からの構造推論に任せると、一部の書にしか無い項目を足したとたんに
// 共用体が割れて他の項目が読めなくなる。書の形はここで固定する
export type ScriptureBookData = {
  id: string
  name: string
  chapters: number
  verses: number[]
  isFrontMatter?: boolean
  // 章の呼び方。既定は「章」で、詩篇だけ「篇」
  chapterUnit?: string
}

type ScriptureCollectionData = {
  id: string
  name: string
  books: ScriptureBookData[]
}

const collections = scripturesData.collections as ScriptureCollectionData[]

export type ScriptureRef = {
  collection: string
  book: string
  chapter?: number
  verses?: number[]
}

export function findCollection(collectionId: string) {
  return collections.find((c) => c.id === collectionId)
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

// 章の呼び方が要るだけの呼び出し元（章の選択肢など）からも使えるよう、
// 書の全体ではなく必要な項目だけを受ける
type ChapterLabelBook = { name: string; isFrontMatter?: boolean; chapterUnit?: string } | undefined

// 公式の章タイトルの呼び方に合わせる。87書を確認した範囲では、
// 「章」でないのは詩篇（篇）だけ
export function getChapterLabel(book: ChapterLabelBook, chapter: number): string {
  if (book?.isFrontMatter) return book.name
  return `第${chapter}${book?.chapterUnit ?? '章'}`
}

export function getScriptureLabel(ref: ScriptureRef, book: ScriptureBook = findBook(ref)): string {
  const bookName = book?.name ?? ref.book
  if (!ref.chapter) return bookName
  if (!ref.verses?.length) {
    return book?.isFrontMatter ? bookName : `${bookName} ${getChapterLabel(book, ref.chapter)}`
  }
  const sorted = [...ref.verses].sort((a, b) => a - b)
  if (sorted.length === 1) return `${bookName} ${ref.chapter}:${sorted[0]}`
  const isConsecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)
  if (isConsecutive) return `${bookName} ${ref.chapter}:${sorted[0]}–${sorted[sorted.length - 1]}`
  return `${bookName} ${ref.chapter}:${sorted.join(', ')}`
}
