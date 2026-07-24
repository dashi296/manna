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

  it('要素の外にポインタが出てもwindowで検知してドラッグを継続・確定できる（マウスは暗黙キャプチャがないため）', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 200 })
    // pointermove/pointerupが要素にではなくwindowに（要素の外に出た想定で）届く
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 100 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 100 })
    act(() => {
      vi.advanceTimersByTime(SWIPE_ANIMATION_MS)
    })
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '6' },
    })
  })

  it('要素外でドラッグを終えても次のドラッグが使用不能にならない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    // 1回目: 要素外（window）でしきい値未満のまま終える
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 200 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 190 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 190 })
    act(() => {
      vi.advanceTimersByTime(SWIPE_ANIMATION_MS)
    })
    expect(mockNavigate).not.toHaveBeenCalled()

    // 2回目: 通常通り要素内でしきい値を超えて確定できるはず
    drag(el, 200, 100)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '6' },
    })
  })

  it('touch-actionにpinch-zoomを含めピンチズームを妨げない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('style')).toContain('pinch-zoom')
  })

  it('有効時はiOSの長押しリンクプレビュー抑止クラスを付与する', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.className).toContain('no-native-callout')
  })

  it('disabledのときは長押しリンクプレビュー抑止クラスを付与しない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc} disabled>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = container.firstElementChild as HTMLElement
    expect(el.className).not.toContain('no-native-callout')
  })

  it('しきい値を超える左ドラッグで次の章へnavigateする', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 200, 100) // -100px = 400px の25% > 20%しきい値
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '6' },
    })
  })

  it('しきい値を超える右ドラッグで前の章へnavigateする', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 100, 200) // +100px
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
    drag(el, 100, 200) // 前の章方向（右ドラッグ）だが移動先なし
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
    // 1番目のポインタの +100px（右）ドラッグで前の章へnavigateされるべき
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection: 'bofm', book: '1-ne', chapter: '4' },
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

  it('pointerdown単体ではpreventDefault()を呼ばない（タップや長押しなどネイティブ操作を妨げない）', () => {
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
    expect(spy).not.toHaveBeenCalled()
  })

  it('横方向ロック距離未満のpointermoveはpreventDefault()を呼ばず追従もしない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100 })
    const moveEvent = new PointerEvent('pointermove', { pointerId: 1, clientX: 105, bubbles: true })
    const spy = vi.spyOn(moveEvent, 'preventDefault')
    el.dispatchEvent(moveEvent)
    expect(spy).not.toHaveBeenCalled()
    expect(el.getAttribute('style')).toContain('translateX(0px)')
  })

  it('横方向ロック距離を超えたpointermoveでpreventDefault()を呼び追従を開始する', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100 })
    const moveEvent = new PointerEvent('pointermove', { pointerId: 1, clientX: 115, bubbles: true })
    const spy = vi.spyOn(moveEvent, 'preventDefault')
    act(() => {
      el.dispatchEvent(moveEvent)
    })
    expect(spy).toHaveBeenCalled()
    expect(el.getAttribute('style')).toContain('translateX(15px)')
  })

  it('disabledのpointerdown後のpointermoveはpreventDefault()を呼ばない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc} disabled>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100 })
    const moveEvent = new PointerEvent('pointermove', { pointerId: 1, clientX: 200, bubbles: true })
    const spy = vi.spyOn(moveEvent, 'preventDefault')
    el.dispatchEvent(moveEvent)
    expect(spy).not.toHaveBeenCalled()
  })

  it('pointercancelはしきい値を超えていても遷移を確定させない', () => {
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <p>content</p>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100 })
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 200 }) // +100px、しきい値超え
    fireEvent.pointerCancel(el, { pointerId: 1, clientX: 200 })
    act(() => {
      vi.advanceTimersByTime(SWIPE_ANIMATION_MS)
    })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('スワイプ確定後に発火する合成clickは抑止される（節Linkなどへの誤遷移防止）', () => {
    const onChildClick = vi.fn()
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <button type="button" onClick={onChildClick}>child</button>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 100, 200) // しきい値超えで確定
    const button = container.querySelector('button') as HTMLElement
    fireEvent.click(button)
    expect(onChildClick).not.toHaveBeenCalled()
  })

  it('しきい値未満（確定なし）の場合はクリックが通常通り伝播する', () => {
    const onChildClick = vi.fn()
    const { container } = render(
      <SwipeableChapterView loc={loc}>
        <button type="button" onClick={onChildClick}>child</button>
      </SwipeableChapterView>,
    )
    const el = setContainerWidth(container, 400)
    drag(el, 100, 130) // しきい値未満
    const button = container.querySelector('button') as HTMLElement
    fireEvent.click(button)
    expect(onChildClick).toHaveBeenCalled()
  })
})
