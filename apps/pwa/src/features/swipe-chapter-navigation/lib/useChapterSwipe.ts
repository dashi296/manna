import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getAdjacentChapterRef, type ChapterRef } from '@/entities/scripture'

export const SWIPE_COMMIT_RATIO = 0.2
export const SWIPE_ANIMATION_MS = 200

type DragState = {
  pointerId: number
  startX: number
  containerWidth: number
}

export function useChapterSwipe(loc: ChapterRef, disabled: boolean) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const deltaRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)
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
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [loc.collection, loc.book, loc.chapter])

  const targetFor = (dx: number) =>
    dx === 0 ? null : getAdjacentChapterRef(loc, dx > 0 ? 'next' : 'prev')

  const applyDelta = (dx: number) => {
    deltaRef.current = dx
    setDeltaX(dx)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || animating || dragRef.current) return
    const width = containerRef.current?.clientWidth ?? 0
    if (width === 0) return
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, containerWidth: width }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const rawDelta = e.clientX - drag.startX
    applyDelta(targetFor(rawDelta) ? rawDelta : 0)
  }

  const endDrag = (pointerId: number) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== pointerId) return
    dragRef.current = null

    const current = deltaRef.current
    const target = targetFor(current)
    const threshold = drag.containerWidth * SWIPE_COMMIT_RATIO

    if (target && Math.abs(current) >= threshold) {
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

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => endDrag(e.pointerId)
  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => endDrag(e.pointerId)

  return {
    containerRef,
    deltaX,
    animating,
    handlers: disabled
      ? undefined
      : { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}
