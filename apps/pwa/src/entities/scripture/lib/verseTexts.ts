import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@manna/database'
import type { ChapterRef } from './scriptureNavigation'

export type VerseTextRow = { verse: number; text_html: string }

// SSR ローダー（サーバーのクライアント）とブラウザの両方から呼ぶ。どちらも
// 構造的に同じ SupabaseClient<Database> なので、型はひとつで足りる。
// エラーを空配列として握りつぶすと、SSR では章表示が「0件」に見え、
// クライアントでは React Query が「取得成功」とみなして staleTime: Infinity の
// キャッシュに乗ってしまう（通信復旧後も再取得されない）ため、必ず throw する。
export async function queryScriptureVerseTexts(
  client: SupabaseClient<Database>,
  { collection, book, chapter }: ChapterRef,
  language: string,
  verses?: number[],
  signal?: AbortSignal,
): Promise<VerseTextRow[]> {
  let query = client
    .from('scripture_verses')
    .select('verse, text_html')
    .eq('collection_id', collection)
    .eq('book_id', book)
    .eq('chapter', chapter)
    .eq('language', language)
    .order('verse', { ascending: true })
  if (verses?.length) {
    query = query.in('verse', verses)
  }
  if (signal) {
    query = query.abortSignal(signal)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as VerseTextRow[]
}
