import scripturesData from '@/shared/config/scriptures.json'
import { findBook } from '@/shared/lib/scriptureUtils'

export type { ScriptureRef } from '@/shared/lib/scriptureUtils'
export { buildScriptureUrl, getScriptureLabel, findCollection as getCollection } from '@/shared/lib/scriptureUtils'

export function getBook(collectionId: string, bookId: string) {
  return findBook({ collection: collectionId, book: bookId })
}

export function getAllCollections() {
  return scripturesData.collections
}
