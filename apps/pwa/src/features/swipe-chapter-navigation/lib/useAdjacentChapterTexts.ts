import { useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  getAdjacentChapterRef,
  scriptureVerseTextsQuery,
  type ChapterRef,
  type VerseTextRow,
} from '@/entities/scripture'
import { PRIMARY_LANGUAGE, SECONDARY_LANGUAGE } from '@/shared/config/scriptureLanguage'

// 章を開いた直後は本体の描画が優先。隣の章はアイドルまで待ってから取りに行く
const IDLE_TIMEOUT_MS = 2000

export type ChapterTexts = {
  ref: ChapterRef
  primary: Map<number, string>
  secondary: Map<number, string>
}

type Params = { loc: ChapterRef; enabled: boolean; bilingual: boolean }

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

// 隣の章の節本文を先読みする。ページ本体・SSR のローダーと同じクエリ定義を使うので、
// 先読みした本文は遷移した先でもそのまま使われ、取り直しにならない
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

  const results = useQueries({
    queries: [
      { ref: prevRef, language: PRIMARY_LANGUAGE, on: true },
      { ref: nextRef, language: PRIMARY_LANGUAGE, on: true },
      { ref: prevRef, language: SECONDARY_LANGUAGE, on: bilingual },
      { ref: nextRef, language: SECONDARY_LANGUAGE, on: bilingual },
    ].map(({ ref, language, on }) => ({
      ...scriptureVerseTextsQuery(ref ?? loc, language),
      // 取得を始めるかどうかだけを決める。始まっている取得は中断されない
      enabled: ready && on && ref !== null,
      // 先読みなので、落ちたらラベル表示に落ちるだけでよい。粘って通信を増やさない
      retry: false,
    })),
  })

  const [prevPrimary, nextPrimary, prevSecondary, nextSecondary] = results

  return useMemo(
    () => ({
      prev: prevRef && prevPrimary.data
        ? { ref: prevRef, primary: toMap(prevPrimary.data), secondary: toMap(prevSecondary.data) }
        : null,
      next: nextRef && nextPrimary.data
        ? { ref: nextRef, primary: toMap(nextPrimary.data), secondary: toMap(nextSecondary.data) }
        : null,
    }),
    [prevRef, nextRef, prevPrimary.data, nextPrimary.data, prevSecondary.data, nextSecondary.data],
  )
}
