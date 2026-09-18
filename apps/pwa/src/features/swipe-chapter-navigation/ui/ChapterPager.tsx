import type { CSSProperties, ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getChapterNavLabel, type ChapterRef } from '@/entities/scripture'
import { useChapterPager } from '../lib/useChapterPager'
import type { ChapterTexts } from '../lib/useAdjacentChapterTexts'

type Props = {
  loc: ChapterRef
  // 節選択モードやシートを開いている間など、横スワイプを譲るべき場面で立てる
  disabled: boolean
  // 先読みできた隣の章を、指で引いている間だけ両脇に描く。節の見た目を本体と
  // 揃えるため、マークアップはページ側に任せる
  renderPreview?: (texts: ChapterTexts) => ReactNode
  children: ReactNode
}

const panelClass = 'relative w-full min-w-0 shrink-0 snap-start'
const panelStyle = { scrollSnapStop: 'always' as const }

// 見えるのは画面1つぶんだけ。それ以上描いてもパネルの高さ（＝本文の高さ）に
// 埋もれるので切り落とす
const previewStyle = (top: number): CSSProperties => ({
  position: 'absolute',
  top,
  left: 0,
  width: '100%',
  height: '100dvh',
  overflow: 'hidden',
})

// 章の本文を横スクロールの中央パネルに置き、両脇の空パネルへ着地したら隣の章へ移る。
// ジェスチャの処理をブラウザに任せるのが狙い。方向ロック・パン後のクリック抑止・
// 慣性は、自前のポインタ処理では作り直しになる
export function ChapterPager({ loc, disabled, renderPreview, children }: Props) {
  const {
    containerRef,
    prev,
    next,
    scrollable,
    onScroll,
    onTouchStart,
    onTouchEnd,
    destination,
    direction,
    previewTop,
    previews,
  } = useChapterPager({ loc, disabled })

  const panelPreview = (side: 'prev' | 'next') => {
    const texts = previews[side]
    if (!texts || !renderPreview) return null
    return (
      // 触れられると本体と二重の導線になる。読み上げからも外す
      <div
        data-testid={`chapter-pager-preview-${side}`}
        aria-hidden
        inert
        style={previewStyle(previewTop)}
      >
        {renderPreview(texts)}
      </div>
    )
  }

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
          // 両脇のパネルが後から挿入されると、ブラウザが見た目を保とうとして
          // その幅だけスクロール位置をずらす。中央合わせと二重になる
          overflowAnchor: 'none',
        }}
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {prev && (
          <div
            data-testid="chapter-pager-prev"
            aria-hidden
            className={panelClass}
            style={panelStyle}
          >
            {panelPreview('prev')}
          </div>
        )}
        <div className={panelClass} style={panelStyle}>
          {children}
        </div>
        {next && (
          <div
            data-testid="chapter-pager-next"
            aria-hidden
            className={panelClass}
            style={panelStyle}
          >
            {panelPreview('next')}
          </div>
        )}
      </div>
      {destination && !(direction && previews[direction] && renderPreview) && (
        // 脇のパネルは章の高さぶん縦に伸びるため、その中にラベルを置くと下の方を
        // 読んでいるときに画面外へ出る。画面に固定して重ねる
        <div
          data-testid="chapter-pager-label"
          aria-hidden
          className="fixed left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-4 py-2 text-sm shadow-lg pointer-events-none text-primary"
          style={{ background: 'var(--surface-strong)' }}
        >
          {direction === 'prev' && <ChevronLeft size={16} />}
          {getChapterNavLabel(destination, loc.book)}
          {direction === 'next' && <ChevronRight size={16} />}
        </div>
      )}
    </>
  )
}
