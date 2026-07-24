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
      // -webkit-touch-callout はインラインstyleでは disabled 変化時に再設定できない
      // （CSSOM経由の更新が効かずSSR時点の値のまま固定される）ため、
      // className の付け外しで切り替える（.no-native-callout は styles.css）。
      className={disabled ? undefined : 'no-native-callout'}
      style={{
        transform: `translateX(${deltaX}px)`,
        transition: animating ? `transform ${SWIPE_ANIMATION_MS}ms ease-out` : 'none',
        // pinch-zoom を明示しないと pan-y だけではピンチズームまで無効化されてしまう。
        touchAction: 'pan-y pinch-zoom',
      }}
      {...handlers}
    >
      {children}
    </div>
  )
}
