import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getAdjacentChapterRef, type ChapterRef } from '@/entities/scripture'
import { useBilingualEnabled } from '@/entities/bilingual-display'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { useAdjacentChapterTexts } from './useAdjacentChapterTexts'

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

  const bilingual = useBilingualEnabled()
  // 選択モードやシートを開いている間は横スワイプを譲っている。新しい先読みも始めない
  // （開始済みの取得はそのまま完了する）
  const adjacentTexts = useAdjacentChapterTexts({ loc, enabled: scrollable, bilingual })

  // 判定待ちのタイマーは古いクロージャを掴んだままになるため、最新の値を ref で読む
  // 代入をレンダー中に置くと、破棄されたレンダーの値が残る。着地判定を止める
  // ガードなので、塗り前に確定する useLayoutEffect で反映の遅れも作らない
  const scrollableRef = useRef(scrollable)
  useLayoutEffect(() => {
    scrollableRef.current = scrollable
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const [pointing, setPointing] = useState<'prev' | 'next' | null>(null)
  // 移動先のプレビューは横に動き始めてから出す。章ぶんの節をずっと描いておく
  // 必要はない。触れた時点で組むと、タップや縦スクロールのたびに隣の章ぶんの
  // マウントとアンマウントを払うことになり、指を離すまでの処理が丸ごと遅れる
  const [gesture, setGesture] = useState<{ previewTop: number } | null>(null)
  // 縦位置は触れた時点で測り、横に動き始めた最初の1回だけ状態へ移す。
  // 測っただけでは描き直す理由にならないので、それまでは ref に置く
  const measuredTop = useRef(0)
  // 同じジェスチャーで組み直さないための印。プレビューを出したまま次の指が
  // 来ることがあるため、「組んだかどうか」ではなく「触れてから組んだか」で持つ
  const topPending = useRef(false)
  // 遷移待ちの間に着地判定が二重で走らないようにする
  const navigated = useRef(false)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // 指が触れるまで着地判定を始めない。ブラウザはパネルの増減やフォントの到着でも
  // スナップをやり直すことがあり、それを「隣まで引かれた」と読むと読み込み直後に
  // 勝手に隣の章へ飛ぶ
  const touched = useRef(false)
  // ページャの上で始まった指を identifier で覚えておく。指を止めているだけでも
  // スクロールは静止するので、離すまでは着地とみなさない。
  // ポインタイベントは横パンが始まると pointercancel で打ち切られるため、
  // タッチイベントで追う。
  // 件数を数えるのではなく identifier の集合で持つ理由は2つある。
  // touchend / touchcancel は複数の接触点を1イベントでまとめて終わらせるので
  // 1件ずつ減らすと指が残っている扱いのままになる。また event.touches は
  // 画面上の全接触点で、ページャの外に置かれた指まで含んでしまう
  const activeTouches = useRef(new Set<number>())

  const centerOffset = useCallback((el: HTMLDivElement) => (prev ? el.clientWidth : 0), [prev])

  // CSS では中央のパネルから開始できないため、描画前に位置を合わせる
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollLeft = centerOffset(el)
  }, [centerOffset, next])

  useEffect(() => () => clearTimeout(settleTimer.current), [])

  // 無効化されたらジェスチャーを畳む。判定を止めるだけだと、引きかけの位置と
  // 「触れた」状態が残り、シートを閉じた後のスナップのやり直しを章移動と読んでしまう。
  // 表示state は effect を待たずレンダー中に畳む（畳んだ結果は centerOffset に
  // 影響しない。あれは prev の有無と clientWidth だけで決まる）
  const [prevScrollable, setPrevScrollable] = useState(scrollable)
  if (scrollable !== prevScrollable) {
    setPrevScrollable(scrollable)
    if (!scrollable) {
      setPointing(null)
      setGesture(null)
    }
  }

  // ref とスクロール位置の後始末。こちらは DOM を触るので effect に残す
  useEffect(() => {
    if (scrollable) return
    clearTimeout(settleTimer.current)
    touched.current = false
    activeTouches.current.clear()
    const el = containerRef.current
    if (el) el.scrollLeft = centerOffset(el)
  }, [scrollable, centerOffset])

  const settle = useCallback(() => {
    const el = containerRef.current
    if (!el || navigated.current) return
    // 判定待ちの間にシートが開くこともある
    if (!scrollableRef.current) return
    if (!touched.current || activeTouches.current.size > 0) return
    const width = el.clientWidth
    if (width === 0) return

    const index = Math.round(el.scrollLeft / width)
    const centerIndex = prev ? 1 : 0
    const target = index < centerIndex ? prev : index > centerIndex ? next : null
    if (!target) {
      // ここでジェスチャーは終わり。次に触れるまでは本文のパネルに留める側へ戻す
      touched.current = false
      setPointing(null)
      setGesture(null)
      return
    }

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

  const scheduleSettle = useCallback(() => {
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(settle, SETTLE_MS)
  }, [settle])

  const onTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    touched.current = true
    for (const touch of Array.from(event.changedTouches)) {
      activeTouches.current.add(touch.identifier)
    }

    // パネルは章の高さぶん縦に伸びる。プレビューを先頭に置くと、下の方を
    // 読んでいるときに画面の外へ出るため、いま見えている位置に合わせる。
    // 横ドラッグ中は方向ロックで縦に動かないので、触れた時点の1回で足りる。
    //
    // スクロール量をそのまま下げ幅にすると、プレビューはコンテナの先頭
    // （＝章の本文が始まる位置）に重なる。遷移した先も本文はそこから始まるので、
    // ヘッダーやその下の行の高さを知らなくても縦位置が揃う
    measuredTop.current = window.scrollY
    topPending.current = true
  }, [])

  const onTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      for (const touch of Array.from(event.changedTouches)) {
        activeTouches.current.delete(touch.identifier)
      }
      // 指を止めたまま離した場合、スクロールイベントはもう来ない
      scheduleSettle()
    },
    [scheduleSettle],
  )

  const onScroll = useCallback(() => {
    const el = containerRef.current
    if (!el || navigated.current) return

    // 指が触れるまでは本文のパネルに留める。両脇のパネルはマウント後に現れるため、
    // 挿入ぶんを打ち消すスクロールアンカリングや、ルーターのスクロール復元、
    // ブラウザによるスナップのやり直しが、中央合わせの後から位置を動かしうる。
    // overflow: hidden でもプログラムからのスクロールは通るので、無効化中も見張る
    if (!scrollable || !touched.current) {
      const center = centerOffset(el)
      if (el.scrollLeft !== center) el.scrollLeft = center
      return
    }

    const offset = el.scrollLeft - centerOffset(el)
    // 横に動いたことをブラウザが認めた時点で組む。触れただけでは組まない。
    // 毎回オブジェクトを作り直すのは、前のプレビューが残ったまま次の指が来た場合に
    // 同じ値の更新として捨てられ、縦位置が前のジェスチャーのままになるため
    if (offset !== 0 && topPending.current) {
      topPending.current = false
      setGesture({ previewTop: measuredTop.current })
    }
    setPointing(offset > LABEL_THRESHOLD_PX ? 'next' : offset < -LABEL_THRESHOLD_PX ? 'prev' : null)

    scheduleSettle()
  }, [centerOffset, scrollable, scheduleSettle])

  return {
    containerRef,
    prev,
    next,
    scrollable,
    onScroll,
    onTouchStart: scrollable ? onTouchStart : undefined,
    onTouchEnd: scrollable ? onTouchEnd : undefined,
    destination: pointing === 'next' ? next : pointing === 'prev' ? prev : null,
    direction: pointing,
    previewTop: gesture?.previewTop ?? 0,
    previews: gesture ? adjacentTexts : { prev: null, next: null },
  }
}
