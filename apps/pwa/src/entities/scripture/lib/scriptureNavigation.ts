import { findBook, findCollection } from '@/shared/lib/scriptureUtils'

export type ChapterRef = { collection: string; book: string; chapter: number }

export function getAdjacentChapterRef(
  current: ChapterRef,
  direction: 'next' | 'prev',
): ChapterRef | null {
  const book = findBook(current)
  if (!book) return null

  if (direction === 'next' && current.chapter < book.chapters) {
    return { ...current, chapter: current.chapter + 1 }
  }
  if (direction === 'prev' && current.chapter > 1) {
    return { ...current, chapter: current.chapter - 1 }
  }

  const collection = findCollection(current.collection)
  if (!collection) return null

  const bookIndex = collection.books.findIndex((b) => b.id === current.book)
  if (bookIndex === -1) return null

  const step = direction === 'next' ? 1 : -1
  for (let i = bookIndex + step; i >= 0 && i < collection.books.length; i += step) {
    const candidate = collection.books[i]
    if (candidate.isFrontMatter) continue
    return {
      collection: current.collection,
      book: candidate.id,
      chapter: direction === 'next' ? 1 : candidate.chapters,
    }
  }
  return null
}
