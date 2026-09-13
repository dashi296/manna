import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getChapterNavLabel, type ChapterRef } from '@/entities/scripture'
import { useChapterPager } from '../lib/useChapterPager'

type Props = {
  loc: ChapterRef
  // 節選択モードやシートを開いている間など、横スワイプを譲るべき場面で立てる
  disabled: boolean
  children: ReactNode
}

const panelClass = 'w-full min-w-0 shrink-0 snap-start'
const panelStyle = { scrollSnapStop: 'always' as const }

// 章の本文を横スクロールの中央パネルに置き、両脇の空パネルへ着地したら隣の章へ移る。
// ジェスチャの処理をブラウザに任せるのが狙い。方向ロック・パン後のクリック抑止・
// 慣性は、自前のポインタ処理では作り直しになる
export function ChapterPager({ loc, disabled, children }: Props) {
  const { containerRef, prev, next, scrollable, onScroll, destination, direction } =
    useChapterPager({ loc, disabled })

  return (
    <>
      <div
        ref={containerRef}
        data-testid="chapter-pager"
        className="no-scrollbar flex"
        style={{
          overflowX: scrollable ? 'auto' : 'hidden',
          scrollSnapType: scrollable ? 'x mandatory' : undefined,
          overscrollBehaviorX: 'contain',
        }}
        onScroll={onScroll}
      >
        {prev && (
          <div data-testid="chapter-pager-prev" aria-hidden className={panelClass} style={panelStyle} />
        )}
        <div className={panelClass} style={panelStyle}>
          {children}
        </div>
        {next && (
          <div data-testid="chapter-pager-next" aria-hidden className={panelClass} style={panelStyle} />
        )}
      </div>
      {destination && (
        // 脇のパネルは章の高さぶん縦に伸びるため、その中にラベルを置くと下の方を
        // 読んでいるときに画面外へ出る。画面に固定して重ねる
        <div
          data-testid="chapter-pager-label"
          aria-hidden
          className="fixed left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-4 py-2 text-sm shadow-lg pointer-events-none"
          style={{ background: 'var(--surface-strong)', color: 'var(--lagoon-deep)' }}
        >
          {direction === 'prev' && <ChevronLeft size={16} />}
          {getChapterNavLabel(destination, loc.book)}
          {direction === 'next' && <ChevronRight size={16} />}
        </div>
      )}
    </>
  )
}
