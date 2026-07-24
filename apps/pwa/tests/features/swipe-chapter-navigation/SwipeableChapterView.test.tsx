import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { SwipeableChapterView } from '@/features/swipe-chapter-navigation'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

function setContainerWidth(container: HTMLElement, width: number) {
  const el = container.firstElementChild as HTMLElement
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width })
  return el
}

// navigate は「スライドアウトしてから遷移する」設計のため setTimeout(200ms) 経由で呼ばれる。
// フェイクタイマーで進めないと drag() 直後の同期アサートでは間に合わない。
function drag(el: HTMLElement, startX: number, endX: number) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: startX })
  fireEvent.pointerMove(el, { pointerId: 1, clientX: endX })
  fireEvent.pointerUp(el, { pointerId: 1, clientX: endX })
  act(() => {
    vi.advanceTimersByTime(200)
  })
}

const loc = { collection: 'bofm', book: '1-ne', chapter: 5 }

describe('SwipeableChapterView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockNavigate.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('しきい値を超える右ドラッグで次の章へnavigateする', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 100, 200) // +100px = 400px の25% > 20%しきい値
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '6' },
    })
  })

  it('しきい値を超える左ドラッグで前の章へnavigateする', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 200, 100) // -100px
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '4' },
    })
  })

  it('しきい値未満のドラッグではnavigateしない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 100, 130) // +30px = 7.5% < 20%
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('disabledのときはドラッグしてもnavigateしない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc} disabled>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 100, 200)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('移動先が無い方向（コレクション先頭）ではnavigateしない', () => {
    const { container } = render(
      <SwipeableChapterView loc={{ collection: 'pgp', book: 'moses', chapter: 1 }}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 200, 100) // 前方向だが移動先なし
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
