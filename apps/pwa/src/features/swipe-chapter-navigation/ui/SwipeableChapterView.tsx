import type { ReactNode } from 'react'
import type { ChapterRef } from '@/entities/scripture'
import { useChapterSwipe, SWIPE_ANIMATION_MS } from '../lib/useChapterSwipe'

type SwipeableChapterViewProps = {
  loc: ChapterRef
  disabled?: boolean
  children: ReactNode
}

export function SwipeableChapterView({ loc, disabled = false, children }: SwipeableChapterViewProps) {
  const { containerRef, deltaX, animating, handlers } = useChapterSwipe(loc, disabled)

  return (
    <div
      ref={containerRef}
      style={{
        transform: `translateX(${deltaX}px)`,
        transition: animating ? `transform ${SWIPE_ANIMATION_MS}ms ease-out` : 'none',
        touchAction: 'pan-y',
      }}
      {...handlers}
    >
      {children}
    </div>
  )
}
