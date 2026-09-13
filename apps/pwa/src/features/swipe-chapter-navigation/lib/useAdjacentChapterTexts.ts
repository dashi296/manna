import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  getAdjacentChapterRef,
  queryScriptureVerseTexts,
  type ChapterRef,
  type VerseTextRow,
} from '@/entities/scripture'
import { supabase } from '@/shared/lib/supabase'
import { SECONDARY_LANGUAGE } from '@/shared/config/scriptureLanguage'

const CHAPTER_ROUTE = '/scriptures/$collection/$book/$chapter'

// 節テキストは変わらないので、一度取ったら取り直さない。読み進めるほど溜まるため、
// 破棄までの猶予は設ける
const GC_TIME = 30 * 60 * 1000

// 章を開いた直後は本体の描画が優先。隣の章はアイドルまで待ってから取りに行く
const IDLE_TIMEOUT_MS = 2000

export type ChapterTexts = {
  ref: ChapterRef
  primary: Map<number, string>
  secondary: Map<number, string>
}

type Params = { loc: ChapterRef; enabled: boolean; bilingual: boolean }
type Side = 'prev' | 'next'

function refToParams(ref: ChapterRef) {
  return { collection: ref.collection, book: ref.book, chapter: String(ref.chapter) }
}

function toMap(rows: VerseTextRow[] | undefined) {
  return new Map((rows ?? []).map((row) => [row.verse, row.text_html]))
}

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

// 併記の英文はルートの loader が取らないので、こちらは直接引く
function useSecondaryTexts(ref: ChapterRef | null, enabled: boolean) {
  const { data } = useQuery({
    queryKey: ['scripture-verse-secondary-text', ref?.collection, ref?.book, ref?.chapter, []],
    queryFn: ({ signal }) =>
      queryScriptureVerseTexts(supabase, ref as ChapterRef, SECONDARY_LANGUAGE, undefined, signal),
    enabled: enabled && ref !== null,
    staleTime: Infinity,
    gcTime: GC_TIME,
  })
  return useMemo(() => toMap(data), [data])
}

// 隣の章をルートごと先読みする。スワイプ中に移動先を見せるためと、指を離した後の
// 遷移で取り直さないため。節本文だけを別に引くと、遷移時に同じものをもう一度取る
export function useAdjacentChapterTexts({ loc, enabled, bilingual }: Params) {
  const router = useRouter()
  const { collection, book, chapter } = loc
  const { prevRef, nextRef } = useMemo(() => {
    const ref = { collection, book, chapter }
    return {
      prevRef: getAdjacentChapterRef(ref, 'prev'),
      nextRef: getAdjacentChapterRef(ref, 'next'),
    }
  }, [collection, book, chapter])

  // router を依存に置くと、実装によっては毎描画で作り直されて先読みが回り続ける
  const routerRef = useRef(router)
  routerRef.current = router

  const ready = useIdle(enabled) && enabled
  const [primary, setPrimary] = useState<Record<Side, Map<number, string> | null>>({
    prev: null,
    next: null,
  })

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setPrimary({ prev: null, next: null })

    const preload = async (ref: ChapterRef | null, side: Side) => {
      if (!ref) return
      try {
        const matches = await routerRef.current.preloadRoute({ to: CHAPTER_ROUTE, params: refToParams(ref) })
        const data = matches?.at(-1)?.loaderData as { verseTexts?: VerseTextRow[] } | undefined
        if (cancelled || !data?.verseTexts) return
        setPrimary((current) => ({ ...current, [side]: toMap(data.verseTexts) }))
      } catch {
        // 先読みが失敗しても本体の表示には影響しない。移動先はラベルにとどまる
      }
    }

    void preload(prevRef, 'prev')
    void preload(nextRef, 'next')
    return () => {
      cancelled = true
    }
  }, [ready, prevRef, nextRef])

  const prevSecondary = useSecondaryTexts(prevRef, ready && bilingual)
  const nextSecondary = useSecondaryTexts(nextRef, ready && bilingual)

  return useMemo(
    () => ({
      prev: prevRef && primary.prev
        ? { ref: prevRef, primary: primary.prev, secondary: prevSecondary }
        : null,
      next: nextRef && primary.next
        ? { ref: nextRef, primary: primary.next, secondary: nextSecondary }
        : null,
    }),
    [prevRef, nextRef, primary, prevSecondary, nextSecondary],
  )
}
