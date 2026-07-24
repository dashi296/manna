import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getAdjacentChapterRef, type ChapterRef } from '@/entities/scripture'

export const SWIPE_COMMIT_RATIO = 0.2
export const SWIPE_ANIMATION_MS = 200
// この距離までは横方向の意図を確定しない。ロック前は preventDefault() を呼ばないため、
// タップや縦スクロール、iOSのリンク長押しプレビューなどネイティブな挙動を妨げない。
const DIRECTION_LOCK_PX = 10

type DragState = {
  pointerId: number
  startX: number
  containerWidth: number
  locked: boolean
}

export function useChapterSwipe(loc: ChapterRef, disabled: boolean) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const deltaRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)
  const clickSuppressorRef = useRef<(() => void) | null>(null)
  const [deltaX, setDeltaX] = useState(0)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    deltaRef.current = 0
    dragRef.current = null
    setDeltaX(0)
    setAnimating(false)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    clickSuppressorRef.current?.()
    detachWindowListeners()
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      clickSuppressorRef.current?.()
      detachWindowListeners()
    }
  }, [loc.collection, loc.book, loc.chapter])

  // 左スワイプ（指を左に動かす = dx < 0）で次の章、右スワイプで前の章。
  // 写真送り・ページめくり系アプリの一般的な慣習に合わせている。
  const targetFor = (dx: number) =>
    dx === 0 ? null : getAdjacentChapterRef(loc, dx > 0 ? 'prev' : 'next')

  const applyDelta = (dx: number) => {
    deltaRef.current = dx
    setDeltaX(dx)
  }

  // move/up/cancel は要素ではなく window に登録する。マウスドラッグは要素外に
  // ポインタが出ると暗黙のキャプチャがなく、要素側のリスナーには届かなくなって
  // dragRef が残り続けてしまうため（setPointerCapture はCDP/一部環境で逆に
  // pointercancel を誘発することを確認したため使わない）。
  const detachWindowListeners = () => {
    window.removeEventListener('pointermove', onWindowPointerMove)
    window.removeEventListener('pointerup', onWindowPointerUp)
    window.removeEventListener('pointercancel', onWindowPointerCancel)
  }

  const onWindowPointerMove = (e: PointerEvent) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const rawDelta = e.clientX - drag.startX

    if (!drag.locked) {
      if (Math.abs(rawDelta) < DIRECTION_LOCK_PX) return
      drag.locked = true
    }
    e.preventDefault()
    applyDelta(targetFor(rawDelta) ? rawDelta : 0)
  }

  // 確定したスワイプの直後にブラウザが合成する click（例: 節本文を包む Link）が
  // 二重に発火しないよう、次の1回だけ捕捉フェーズで握りつぶす。
  const armClickSuppression = () => {
    const container = containerRef.current
    if (!container) return
    clickSuppressorRef.current?.()
    const onClickCapture = (ev: MouseEvent) => {
      container.removeEventListener('click', onClickCapture, true)
      clickSuppressorRef.current = null
      ev.preventDefault()
      ev.stopPropagation()
    }
    container.addEventListener('click', onClickCapture, true)
    clickSuppressorRef.current = () => container.removeEventListener('click', onClickCapture, true)
  }

  const endDrag = (pointerId: number, canceled: boolean) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== pointerId) return
    dragRef.current = null
    detachWindowListeners()

    const current = deltaRef.current
    const target = targetFor(current)
    const threshold = drag.containerWidth * SWIPE_COMMIT_RATIO

    // pointercancel はユーザーが指を離して確定した操作ではないため、
    // どれだけ移動していても遷移は確定させず必ずスナップバックする。
    if (!canceled && drag.locked && target && Math.abs(current) >= threshold) {
      armClickSuppression()
      setAnimating(true)
      applyDelta(current > 0 ? drag.containerWidth : -drag.containerWidth)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => {
        navigate({
          to: '/scriptures/$collection/$book/$chapter',
          params: {
            collection: target.collection,
            book: target.book,
            chapter: String(target.chapter),
          },
        })
      }, SWIPE_ANIMATION_MS)
      return
    }

    setAnimating(true)
    applyDelta(0)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setAnimating(false), SWIPE_ANIMATION_MS)
  }

  const onWindowPointerUp = (e: PointerEvent) => endDrag(e.pointerId, false)
  const onWindowPointerCancel = (e: PointerEvent) => endDrag(e.pointerId, true)

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || animating || dragRef.current) return
    const width = containerRef.current?.clientWidth ?? 0
    if (width === 0) return
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, containerWidth: width, locked: false }
    window.addEventListener('pointermove', onWindowPointerMove)
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onWindowPointerCancel)
  }

  return {
    containerRef,
    deltaX,
    animating,
    handlers: disabled ? undefined : { onPointerDown },
  }
}
