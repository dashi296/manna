import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { SwipeableChapterView, SWIPE_ANIMATION_MS } from '@/features/swipe-chapter-navigation'

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
    vi.advanceTimersByTime(SWIPE_ANIMATION_MS)
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

  it('複数タッチ：2番目のポインタIDが最初のドラッグをハイジャックしない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    // 1番目のポインタでドラッグ開始
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 150 })
    // 2番目のポインタが触れる（無視されるべき）
    fireEvent.pointerDown(el, { pointerId: 2, clientX: 100 })
    // 1番目のポインタが続ける（ハイジャックされずに機能するべき）
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 200 })
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 200 })
    act(() => {
      vi.advanceTimersByTime(SWIPE_ANIMATION_MS)
    })
    // 1番目のポインタの +100px ドラッグで navigateされるべき
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '6' },
    })
  })

  it('アンマウント時に待機中のnavigateタイムアウトがキャンセルされる', () => {
    const { container, unmount } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    // ドラッグしてnavigateをスケジュール
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 200 })
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 200 })
    // タイムアウト前にアンマウント
    unmount()
    // タイマーを進める
    act(() => {
      vi.advanceTimersByTime(SWIPE_ANIMATION_MS)
    })
    // タイムアウトがキャンセルされていたのでnavigateは呼ばれないはず
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('有効なpointerdownはpreventDefault()を呼ぶ（ブラウザのデフォルト動作を抑止）', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    const event = new PointerEvent('pointerdown', {
      pointerId: 1,
      clientX: 100,
      bubbles: true,
    })
    const spy = vi.spyOn(event, 'preventDefault')
    el.dispatchEvent(event)
    expect(spy).toHaveBeenCalled()
  })

  it('disabledのpointerdownはpreventDefault()を呼ばない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc} disabled>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    const event = new PointerEvent('pointerdown', {
      pointerId: 1,
      clientX: 100,
      bubbles: true,
    })
    const spy = vi.spyOn(event, 'preventDefault')
    el.dispatchEvent(event)
    expect(spy).not.toHaveBeenCalled()
  })
})
