import scripturesData from '@/shared/config/scriptures.json'

export type { ScriptureRef } from '@/shared/lib/scriptureUtils'
export { buildScriptureUrl, getScriptureLabel } from '@/shared/lib/scriptureUtils'

export function getCollection(collectionId: string) {
  return scripturesData.collections.find((c) => c.id === collectionId)
}

export function getBook(collectionId: string, bookId: string) {
  return getCollection(collectionId)?.books.find((b) => b.id === bookId)
}

export function getAllCollections() {
  return scripturesData.collections
}
