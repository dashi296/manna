import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getAdjacentChapterRef,
  queryScriptureVerseTexts,
  type ChapterRef,
} from '@/entities/scripture'
import { supabase } from '@/shared/lib/supabase'
import { PRIMARY_LANGUAGE, SECONDARY_LANGUAGE } from '@/shared/config/scriptureLanguage'

// 節テキストは変わらないので、一度取ったら取り直さない。読み進めるほど溜まるため、
// 破棄までの猶予は設ける
const STALE_TIME = Infinity
const GC_TIME = 30 * 60 * 1000

// 章を開いた直後は本体の描画が優先。隣の章はアイドルまで待ってから取りに行く
const IDLE_TIMEOUT_MS = 2000

export type ChapterTexts = {
  ref: ChapterRef
  primary: Map<number, string>
  secondary: Map<number, string>
}

type Params = { loc: ChapterRef; enabled: boolean; bilingual: boolean }

function useIdle(enabled: boolean) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    if (!enabled) return
    if (typeof requestIdleCallback !== 'function') {
      const timer = setTimeout(() => setIdle(true), 300)
      return () => clearTimeout(timer)
    }
    const handle = requestIdleCallback(() => setIdle(true), { timeout: IDLE_TIMEOUT_MS })
    return () => cancelIdleCallback(handle)
  }, [enabled])
  return idle
}

function useChapterTexts(ref: ChapterRef | null, language: string, enabled: boolean) {
  const { data } = useQuery({
    queryKey: ['scripture-verse-text', ref?.collection, ref?.book, ref?.chapter, language],
    queryFn: ({ signal }) =>
      queryScriptureVerseTexts(supabase, ref as ChapterRef, language, undefined, signal),
    enabled: enabled && ref !== null,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  })
  return useMemo(
    () => new Map((data ?? []).map((row) => [row.verse, row.text_html])),
    [data],
  )
}

// 隣の章の節本文を先読みする。スワイプ中に移動先を見せるのと、
// 続けて送ったときに取り直さないのが目的
export function useAdjacentChapterTexts({ loc, enabled, bilingual }: Params) {
  const { collection, book, chapter } = loc
  const { prevRef, nextRef } = useMemo(() => {
    const ref = { collection, book, chapter }
    return {
      prevRef: getAdjacentChapterRef(ref, 'prev'),
      nextRef: getAdjacentChapterRef(ref, 'next'),
    }
  }, [collection, book, chapter])

  const ready = useIdle(enabled) && enabled

  const prevPrimary = useChapterTexts(prevRef, PRIMARY_LANGUAGE, ready)
  const nextPrimary = useChapterTexts(nextRef, PRIMARY_LANGUAGE, ready)
  const prevSecondary = useChapterTexts(prevRef, SECONDARY_LANGUAGE, ready && bilingual)
  const nextSecondary = useChapterTexts(nextRef, SECONDARY_LANGUAGE, ready && bilingual)

  return useMemo(
    () => ({
      prev: prevRef && prevPrimary.size > 0
        ? { ref: prevRef, primary: prevPrimary, secondary: prevSecondary }
        : null,
      next: nextRef && nextPrimary.size > 0
        ? { ref: nextRef, primary: nextPrimary, secondary: nextSecondary }
        : null,
    }),
    [prevRef, nextRef, prevPrimary, nextPrimary, prevSecondary, nextSecondary],
  )
}
