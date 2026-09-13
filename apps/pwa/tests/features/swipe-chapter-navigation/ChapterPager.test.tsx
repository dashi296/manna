import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ChapterPager } from '@/features/swipe-chapter-navigation'
import type { ChapterTexts } from '@/features/swipe-chapter-navigation'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

let adjacentTexts: { prev: ChapterTexts | null; next: ChapterTexts | null } = { prev: null, next: null }
vi.mock('@/features/swipe-chapter-navigation/lib/useAdjacentChapterTexts', () => ({
  useAdjacentChapterTexts: () => adjacentTexts,
}))

let isMobile = true
vi.mock('@/shared/hooks/use-mobile', () => ({
  useIsMobile: () => isMobile,
}))

const PANEL_WIDTH = 320

// jsdom にはレイアウトがないため、パネル幅とスクロール位置をテスト側で差し込む。
// scrollLeft は jsdom では常に 0 を返す実装なので、要素ごとの値を持たせ替える
const scrollPositions = new WeakMap<Element, number>()

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return PANEL_WIDTH
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
    configurable: true,
    get(this: Element) {
      return scrollPositions.get(this) ?? 0
    },
    set(this: Element, value: number) {
      scrollPositions.set(this, value)
    },
  })
})

const chapterTexts = (chapter: number): ChapterTexts => ({
  ref: { collection: 'bofm', book: '1-ne', chapter },
  primary: new Map([[1, `第${chapter}章の1節`]]),
  secondary: new Map(),
})

beforeEach(() => {
  isMobile = true
  adjacentTexts = { prev: null, next: null }
  navigate.mockClear()
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('pointer: coarse'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList) as typeof window.matchMedia
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

const pager = () => screen.getByTestId('chapter-pager')

function scrollTo(px: number) {
  const el = pager()
  el.scrollLeft = px
  fireEvent.scroll(el)
}

// 指を置く → 引く → 離す。着地判定は指が離れるまで走らない
function swipeTo(px: number) {
  const el = pager()
  fireEvent.touchStart(el)
  scrollTo(px)
  fireEvent.touchEnd(el)
}

function settle() {
  act(() => {
    vi.advanceTimersByTime(300)
  })
}

function renderPager(
  loc = { collection: 'bofm', book: '1-ne', chapter: 5 },
  disabled = false,
  renderPreview?: (texts: ChapterTexts) => React.ReactNode,
) {
  return render(
    <ChapterPager loc={loc} disabled={disabled} renderPreview={renderPreview}>
      <p>章の本文</p>
    </ChapterPager>,
  )
}

const preview = (texts: ChapterTexts) => (
  <p>プレビュー: {texts.ref.chapter}章 / {texts.primary.get(1)}</p>
)

describe('ChapterPager', () => {
  it('両隣に章があるとき、前後のパネルを描画する', () => {
    renderPager()
    expect(screen.getByTestId('chapter-pager-prev')).toBeInTheDocument()
    expect(screen.getByTestId('chapter-pager-next')).toBeInTheDocument()
  })

  it('コレクション先頭では前のパネルを描画しない', () => {
    renderPager({ collection: 'bofm', book: '1-ne', chapter: 1 })
    expect(screen.queryByTestId('chapter-pager-prev')).not.toBeInTheDocument()
    expect(screen.getByTestId('chapter-pager-next')).toBeInTheDocument()
  })

  it('コレクション末尾では次のパネルを描画しない', () => {
    renderPager({ collection: 'bofm', book: 'moro', chapter: 10 })
    expect(screen.getByTestId('chapter-pager-prev')).toBeInTheDocument()
    expect(screen.queryByTestId('chapter-pager-next')).not.toBeInTheDocument()
  })

  it('マウント時に本文のパネルへスクロール位置を合わせる', () => {
    renderPager()
    expect(pager().scrollLeft).toBe(PANEL_WIDTH)
  })

  it('前のパネルがないときは先頭が本文なのでスクロールしない', () => {
    renderPager({ collection: 'bofm', book: '1-ne', chapter: 1 })
    expect(pager().scrollLeft).toBe(0)
  })

  it('次のパネルまでスクロールして静止すると、次の章へ移動する', () => {
    renderPager()
    swipeTo(PANEL_WIDTH * 2)
    settle()
    expect(navigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '6' },
    })
  })

  it('前のパネルまでスクロールして静止すると、前の章へ移動する', () => {
    renderPager()
    swipeTo(0)
    settle()
    expect(navigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '4' },
    })
  })

  it('書の境界をまたぐ移動先も呼び出す', () => {
    renderPager({ collection: 'bofm', book: '1-ne', chapter: 22 })
    swipeTo(PANEL_WIDTH * 2)
    settle()
    expect(navigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '2-ne', chapter: '1' },
    })
  })

  it('本文のパネルで静止しても移動しない', () => {
    renderPager()
    fireEvent.touchStart(pager())
    scrollTo(PANEL_WIDTH * 1.4)
    scrollTo(PANEL_WIDTH)
    fireEvent.touchEnd(pager())
    settle()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('静止する前は移動しない', () => {
    renderPager()
    swipeTo(PANEL_WIDTH * 2)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('指が触れていないうちにずれたら、本文のパネルに戻す', () => {
    // 両脇のパネルはマウント後に現れる。その挿入ぶんを打ち消すスクロールアンカリングや
    // ルーターのスクロール復元が、中央合わせの後から位置を動かす
    renderPager()
    scrollTo(PANEL_WIDTH * 2)
    expect(pager().scrollLeft).toBe(PANEL_WIDTH)
  })

  it('指が触れていないのに位置が変わっても移動しない', () => {
    // ブラウザはパネルの増減やフォントの到着でもスナップをやり直す。
    // それを「隣まで引かれた」と読むと、読み込み直後に勝手に隣の章へ飛ぶ
    renderPager()
    scrollTo(PANEL_WIDTH * 2)
    settle()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('指を止めていても、離すまでは移動しない', () => {
    renderPager()
    fireEvent.touchStart(pager())
    scrollTo(PANEL_WIDTH * 2)
    settle()
    expect(navigate).not.toHaveBeenCalled()

    fireEvent.touchEnd(pager())
    settle()
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('disabled のときは本文を作り直さずにスクロールを止め、移動もしない', () => {
    renderPager({ collection: 'bofm', book: '1-ne', chapter: 5 }, true)
    // 読んでいた位置を失わないよう、パネルの構成自体は変えない
    expect(screen.getByTestId('chapter-pager-prev')).toBeInTheDocument()
    expect(pager()).toHaveStyle({ overflowX: 'hidden' })
    swipeTo(PANEL_WIDTH * 2)
    settle()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('disabled のときも、ずれたら本文のパネルに戻す', () => {
    // overflow: hidden でもプログラムからのスクロールは通る。放っておくと
    // シートを閉じた先が空のパネルになる
    renderPager({ collection: 'bofm', book: '1-ne', chapter: 5 }, true)
    scrollTo(PANEL_WIDTH * 2)
    expect(pager().scrollLeft).toBe(PANEL_WIDTH)
  })

  it('デスクトップではパネルを描画せず、スクロールもさせない', () => {
    isMobile = false
    renderPager()
    expect(screen.queryByTestId('chapter-pager-prev')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chapter-pager-next')).not.toBeInTheDocument()
    expect(pager()).toHaveStyle({ overflowX: 'hidden' })
  })

  it('粗いポインタでない環境ではパネルを描画しない', () => {
    window.matchMedia = ((query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList) as typeof window.matchMedia
    renderPager()
    expect(screen.queryByTestId('chapter-pager-next')).not.toBeInTheDocument()
  })

  it('指で引いている間だけ行先のラベルを出す', () => {
    renderPager()
    expect(screen.queryByTestId('chapter-pager-label')).not.toBeInTheDocument()

    fireEvent.touchStart(pager())
    scrollTo(PANEL_WIDTH * 1.3)
    expect(screen.getByTestId('chapter-pager-label')).toHaveTextContent('第6章')

    scrollTo(PANEL_WIDTH * 0.7)
    expect(screen.getByTestId('chapter-pager-label')).toHaveTextContent('第4章')

    scrollTo(PANEL_WIDTH)
    expect(screen.queryByTestId('chapter-pager-label')).not.toBeInTheDocument()
  })

  it('書をまたぐ行先は書名つきで示す', () => {
    renderPager({ collection: 'bofm', book: '1-ne', chapter: 22 })
    fireEvent.touchStart(pager())
    scrollTo(PANEL_WIDTH * 1.3)
    expect(screen.getByTestId('chapter-pager-label')).toHaveTextContent('第2ニーファイ書 第1章')
  })
})

describe('ChapterPager の移動先プレビュー', () => {
  it('指を置くと、先読み済みの隣の章を両脇に描く', () => {
    adjacentTexts = { prev: chapterTexts(4), next: chapterTexts(6) }
    renderPager({ collection: 'bofm', book: '1-ne', chapter: 5 }, false, preview)

    expect(screen.queryByText(/プレビュー/)).not.toBeInTheDocument()

    fireEvent.touchStart(pager())
    expect(screen.getByText('プレビュー: 4章 / 第4章の1節')).toBeInTheDocument()
    expect(screen.getByText('プレビュー: 6章 / 第6章の1節')).toBeInTheDocument()
  })

  it('先読みが間に合っていない側は描かない', () => {
    adjacentTexts = { prev: null, next: chapterTexts(6) }
    renderPager({ collection: 'bofm', book: '1-ne', chapter: 5 }, false, preview)
    fireEvent.touchStart(pager())
    expect(screen.getByText(/6章/)).toBeInTheDocument()
    expect(screen.queryByText(/4章/)).not.toBeInTheDocument()
  })

  it('プレビューを出せる方向では行先ラベルを出さない', () => {
    adjacentTexts = { prev: null, next: chapterTexts(6) }
    renderPager({ collection: 'bofm', book: '1-ne', chapter: 5 }, false, preview)
    fireEvent.touchStart(pager())
    scrollTo(PANEL_WIDTH * 1.3)
    expect(screen.queryByTestId('chapter-pager-label')).not.toBeInTheDocument()

    // 先読みが無い側はこれまでどおりラベルで示す
    scrollTo(PANEL_WIDTH * 0.7)
    expect(screen.getByTestId('chapter-pager-label')).toHaveTextContent('第4章')
  })

  it('プレビューは画面の現在位置に合わせて置く', () => {
    adjacentTexts = { prev: null, next: chapterTexts(6) }
    renderPager({ collection: 'bofm', book: '1-ne', chapter: 5 }, false, preview)

    // 900px 読み進めた状態（コンテナの上端は画面より 900px 上にある）
    Object.defineProperty(window, 'scrollY', { value: 900, configurable: true })
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: -900 } as DOMRect)

    fireEvent.touchStart(pager())
    // 章の先頭に置くと、下の方を読んでいるときに画面の外へ出る
    expect(screen.getByTestId('chapter-pager-preview-next')).toHaveStyle({ top: '900px' })

    rect.mockRestore()
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })

  it('指を離して元の位置に戻ったらプレビューを畳む', () => {
    adjacentTexts = { prev: null, next: chapterTexts(6) }
    renderPager({ collection: 'bofm', book: '1-ne', chapter: 5 }, false, preview)
    fireEvent.touchStart(pager())
    scrollTo(PANEL_WIDTH * 1.3)
    fireEvent.touchEnd(pager())
    scrollTo(PANEL_WIDTH)
    settle()
    expect(screen.queryByText(/プレビュー/)).not.toBeInTheDocument()
  })
})
