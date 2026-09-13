import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getAdjacentChapterRef, type ChapterRef } from '@/entities/scripture'
import { useIsMobile } from '@/shared/hooks/use-mobile'

// 指を離した後もスナップのアニメーションが続く。最後のスクロールからこの時間
// 動きがなければ着地とみなす。scrollend は Safari の対応が環境で割れるため使わない
const SETTLE_MS = 120

// 行先ラベルを出し始めるずれ幅。触れただけの微動でラベルを点滅させない
const LABEL_THRESHOLD_PX = 8

type Params = { loc: ChapterRef; disabled: boolean }

// ポインタが粗い環境（タッチ）だけを対象にする。狭くしたデスクトップウィンドウで
// トラックパッドの横スクロールが章移動に化けるのを防ぐ
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)')
    const sync = () => setCoarse(mql.matches)
    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [])
  return coarse
}

export function useChapterPager({ loc, disabled }: Params) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const coarse = useCoarsePointer()

  // パネルの構成は disabled では変えない。DOM を作り直すと本文の縦位置を失う
  const interactive = isMobile && coarse
  const scrollable = interactive && !disabled

  const { collection, book, chapter } = loc
  // 毎描画で作り直すと、位置合わせの layout effect がドラッグ中に走って中央へ戻す
  const { prev, next } = useMemo(() => {
    if (!interactive) return { prev: null, next: null }
    const ref = { collection, book, chapter }
    return {
      prev: getAdjacentChapterRef(ref, 'prev'),
      next: getAdjacentChapterRef(ref, 'next'),
    }
  }, [interactive, collection, book, chapter])

  const containerRef = useRef<HTMLDivElement>(null)
  const [pointing, setPointing] = useState<'prev' | 'next' | null>(null)
  // 遷移待ちの間に着地判定が二重で走らないようにする
  const navigated = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // CSS では中央のパネルから開始できないため、描画前に位置を合わせる
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollLeft = prev ? el.clientWidth : 0
  }, [prev, next])

  useEffect(() => () => clearTimeout(settleTimer.current), [])

  const settle = useCallback(() => {
    const el = containerRef.current
    if (!el || navigated.current) return
    const width = el.clientWidth
    if (width === 0) return

    const index = Math.round(el.scrollLeft / width)
    const centerIndex = prev ? 1 : 0
    const target = index < centerIndex ? prev : index > centerIndex ? next : null
    if (!target) return

    navigated.current = true
    navigate({
      to: '/scriptures/$collection/$book/$chapter',
      params: {
        collection: target.collection,
        book: target.book,
        chapter: String(target.chapter),
      },
    })
  }, [navigate, prev, next])

  const onScroll = useCallback(() => {
    const el = containerRef.current
    if (!el || navigated.current) return

    const offset = el.scrollLeft - (prev ? el.clientWidth : 0)
    setPointing(
      offset > LABEL_THRESHOLD_PX ? 'next' : offset < -LABEL_THRESHOLD_PX ? 'prev' : null,
    )

    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(settle, SETTLE_MS)
  }, [prev, settle])

  return {
    containerRef,
    prev,
    next,
    scrollable,
    onScroll: scrollable ? onScroll : undefined,
    destination: pointing === 'next' ? next : pointing === 'prev' ? prev : null,
    direction: pointing,
  }
}
