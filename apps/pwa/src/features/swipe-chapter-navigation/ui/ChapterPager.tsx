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

const panelClass = 'relative w-full min-w-0 shrink-0 snap-start snap-always'

// 見えるのは画面1つぶんだけ。それ以上描いてもパネルの高さ（＝本文の高さ）に
// 埋もれるので切り落とす
const previewClass = 'absolute top-(--chapter-preview-top) left-0 h-dvh w-full overflow-hidden'

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
        className={previewClass}
        style={{ '--chapter-preview-top': `${previewTop}px` } as CSSProperties}
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
        className={`no-scrollbar chapter-scroller flex overscroll-x-contain ${
          scrollable ? 'snap-x snap-mandatory overflow-x-auto' : 'overflow-x-hidden'
        }`}
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {prev && (
          <div data-testid="chapter-pager-prev" aria-hidden className={panelClass}>
            {panelPreview('prev')}
          </div>
        )}
        <div className={panelClass}>{children}</div>
        {next && (
          <div data-testid="chapter-pager-next" aria-hidden className={panelClass}>
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
          className="fixed left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full bg-surface-strong px-4 py-2 text-sm shadow-lg pointer-events-none text-primary"
        >
          {direction === 'prev' && <ChevronLeft size={16} />}
          {getChapterNavLabel(destination, loc.book)}
          {direction === 'next' && <ChevronRight size={16} />}
        </div>
      )}
    </>
  )
}
