import { useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  chapterHeadingQuery,
  getAdjacentChapterRef,
  scriptureVerseTextsQuery,
  type ChapterHeading,
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
  // 移動先の章タイトルと概要。本文の前に入るので、プレビューに出さないと
  // 指を離した瞬間に本文がその高さぶん飛ぶ
  heading: ChapterHeading | null
  secondaryHeading: ChapterHeading | null
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

  const sides = [
    { ref: prevRef, language: PRIMARY_LANGUAGE, on: true },
    { ref: nextRef, language: PRIMARY_LANGUAGE, on: true },
    { ref: prevRef, language: SECONDARY_LANGUAGE, on: bilingual },
    { ref: nextRef, language: SECONDARY_LANGUAGE, on: bilingual },
  ]

  // 取得を始めるかどうかだけを決める（始まっている取得は中断されない）。
  // 先読みなので、落ちたらラベル表示に落ちるだけでよく、粘って通信を増やさない
  const gate = (ref: ChapterRef | null, on: boolean) => ({
    enabled: ready && on && ref !== null,
    retry: false as const,
  })

  const results = useQueries({
    queries: [
      ...sides.map(({ ref, language, on }) => ({
        ...scriptureVerseTextsQuery(ref ?? loc, language),
        ...gate(ref, on),
      })),
      ...sides.map(({ ref, language, on }) => ({
        ...chapterHeadingQuery(ref ?? loc, language),
        ...gate(ref, on),
      })),
    ],
  })

  const [prevPrimary, nextPrimary, prevSecondary, nextSecondary] = results
  const [prevHeading, nextHeading, prevSecondaryHeading, nextSecondaryHeading] = results.slice(4)

  return useMemo(
    () => ({
      // 本文だけ先に返った時点でプレビューを出すと、遅れて届いた見出しのぶん
      // 遷移後に本文が下へ飛ぶ。見出しの取得が終わる（中身が無い章でも）まで待つ
      prev: prevRef && prevPrimary.data && prevHeading.isSuccess
        ? {
            ref: prevRef,
            primary: toMap(prevPrimary.data as VerseTextRow[]),
            secondary: toMap(prevSecondary.data as VerseTextRow[]),
            heading: (prevHeading.data as ChapterHeading | null) ?? null,
            secondaryHeading: (prevSecondaryHeading.data as ChapterHeading | null) ?? null,
          }
        : null,
      next: nextRef && nextPrimary.data && nextHeading.isSuccess
        ? {
            ref: nextRef,
            primary: toMap(nextPrimary.data as VerseTextRow[]),
            secondary: toMap(nextSecondary.data as VerseTextRow[]),
            heading: (nextHeading.data as ChapterHeading | null) ?? null,
            secondaryHeading: (nextSecondaryHeading.data as ChapterHeading | null) ?? null,
          }
        : null,
    }),
    [
      prevRef, nextRef,
      prevPrimary.data, nextPrimary.data, prevSecondary.data, nextSecondary.data,
      prevHeading.data, nextHeading.data, prevSecondaryHeading.data, nextSecondaryHeading.data,
      prevHeading.isSuccess, nextHeading.isSuccess,
    ],
  )
}
