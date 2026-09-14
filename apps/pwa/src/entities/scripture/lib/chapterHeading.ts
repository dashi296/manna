import { queryOptions } from '@tanstack/react-query'
import { getVerseTextClient } from './verseTextsQuery'
import type { ChapterRef } from './scriptureNavigation'

const GC_TIME = 30 * 60 * 1000

export type ChapterHeading = {
  title: string
  summary: string | null
  summaryHtml: string | null
}

// 章のタイトルと概要文。概要があるのは回復された聖典だけで、
// 旧約・新約は summary が null になる
export async function queryChapterHeading(
  { collection, book, chapter }: ChapterRef,
  language: string,
  signal?: AbortSignal,
): Promise<ChapterHeading | null> {
  // abortSignal は maybeSingle() の後では呼べないので、絞り込みの段階で渡す
  let query = (await getVerseTextClient())
    .from('scripture_chapter_headings')
    .select('title, summary, summary_html')
    .eq('collection_id', collection)
    .eq('book_id', book)
    .eq('chapter', chapter)
    .eq('language', language)
  if (signal) query = query.abortSignal(signal)

  const { data, error } = await query.maybeSingle()
  // 節本文と同じ理由で握りつぶさない。空を成功として
  // staleTime: Infinity のキャッシュに乗せると、通信が戻っても出てこなくなる
  if (error) throw error
  if (!data) return null
  return { title: data.title, summary: data.summary, summaryHtml: data.summary_html }
}

export const chapterHeadingKeys = {
  all: ['scripture-chapter-heading'] as const,
  chapter: (ref: ChapterRef, language: string) =>
    [...chapterHeadingKeys.all, language, ref.collection, ref.book, ref.chapter] as const,
}

export function chapterHeadingQuery(ref: ChapterRef, language: string) {
  return queryOptions({
    queryKey: chapterHeadingKeys.chapter(ref, language),
    queryFn: ({ signal }) => queryChapterHeading(ref, language, signal),
    staleTime: Infinity,
    gcTime: GC_TIME,
  })
}
