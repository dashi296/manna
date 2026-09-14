import { queryOptions } from '@tanstack/react-query'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@manna/database'
import { queryScriptureVerseTexts } from './verseTexts'
import type { ChapterRef } from './scriptureNavigation'

// 節本文は変わらない。読み進めるほど溜まるので、破棄までの猶予は設ける
const GC_TIME = 30 * 60 * 1000

let serverClient: SupabaseClient<Database> | undefined

// 同じ queryFn を SSR のローダーとブラウザの両方から動かすためのクライアント選び。
// ブラウザでは既存のクライアントをそのまま使い、二重に持たない。
// サーバーでは節本文が誰にとっても同じ公開データ（RLS は anon にも SELECT を許している）
// なので、cookie もセッションも要らない
async function getVerseTextClient(): Promise<SupabaseClient<Database>> {
  if (typeof window === 'undefined') {
    serverClient ??= createClient<Database>(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    return serverClient
  }
  const { supabase } = await import('@/shared/lib/supabase')
  return supabase
}

// 同じ節の集合が並び順や重複でキーごと割れないようにそろえる
function normalizeVerses(verses: number[] | undefined) {
  return verses?.length ? [...new Set(verses)].sort((a, b) => a - b) : []
}

export const scriptureVerseTextKeys = {
  all: ['scripture-verse-texts'] as const,
  chapter: (ref: ChapterRef, language: string, verses?: number[]) =>
    [
      ...scriptureVerseTextKeys.all,
      language,
      ref.collection,
      ref.book,
      ref.chapter,
      normalizeVerses(verses),
    ] as const,
}

// ページ本体・隣章の先読み・SSR のローダーが同じキャッシュを共有するための一本化した定義。
// 別々に書くとキーがずれ、同じ本文を二度取ることになる
export function scriptureVerseTextsQuery(
  ref: ChapterRef,
  language: string,
  verses?: number[],
) {
  return queryOptions({
    queryKey: scriptureVerseTextKeys.chapter(ref, language, verses),
    queryFn: async ({ signal }) =>
      queryScriptureVerseTexts(await getVerseTextClient(), ref, language, verses, signal),
    staleTime: Infinity,
    gcTime: GC_TIME,
  })
}
