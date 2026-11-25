import { afterEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PostCard, type PostWithUser } from '@/entities/post'

const preloadRoute = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock('@tanstack/react-router', async () =>
  (await import('../../helpers/tanstack')).routerMock(
    undefined,
    undefined,
    undefined,
    {},
    {
      preloadRoute,
    },
  ),
)

const basePost: PostWithUser = {
  id: 'post-1',
  content: 'これは試験投稿です。',
  visibility: 'public',
  created_at: '2026-05-31T10:00:00Z',
  updated_at: '2026-05-31T10:00:00Z',
  scripture_collection: 'bofm',
  scripture_book: '1-ne',
  scripture_chapter: 3,
  scripture_verses: [7],
  user_id: 'user-1',
  users: { display_name: 'テスト太郎', avatar_url: null },
}

function rangeOf(node: Node) {
  const r = document.createRange()
  r.selectNodeContents(node)
  return r
}

// 投稿詳細へのリンクが押されたかを数える（遷移はさせない）
function openClicks() {
  const opened = vi.fn()
  screen.getByRole('link', { name: /テスト太郎/ }).addEventListener('click', (e) => {
    e.preventDefault()
    opened()
  })
  return opened
}

describe('PostCard', () => {
  it('投稿本文を表示する', () => {
    render(<PostCard post={basePost} />)
    expect(screen.getByText('これは試験投稿です。')).toBeInTheDocument()
  })

  it('ユーザーの表示名を表示する', () => {
    render(<PostCard post={basePost} />)
    expect(screen.getByText('テスト太郎')).toBeInTheDocument()
  })

  it('聖典参照ラベルを表示する', () => {
    render(<PostCard post={basePost} />)
    expect(screen.getByText(/第1ニーファイ書/)).toBeInTheDocument()
  })

  it('投稿日時を表示する', () => {
    render(<PostCard post={basePost} />)
    expect(screen.getByText(/2026|5月31日|5月|31/)).toBeInTheDocument()
  })

  it('display_name が null のときは「匿名ユーザー」を表示する', () => {
    const post = { ...basePost, users: { display_name: null, avatar_url: null } }
    render(<PostCard post={post} />)
    expect(screen.getByText('匿名ユーザー')).toBeInTheDocument()
  })

  it('聖典参照が null のときはバッジを表示しない', () => {
    const post = {
      ...basePost,
      scripture_collection: null,
      scripture_book: null,
      scripture_chapter: null,
      scripture_verses: null,
    }
    render(<PostCard post={post} />)
    expect(screen.queryByText(/第1ニーファイ書/)).not.toBeInTheDocument()
  })

  it('投稿詳細へのリンクに、誰のいつの投稿かが分かる名前を付ける', () => {
    render(<PostCard post={basePost} />)
    // 包むのは日付だけなので、中身まかせだと「5月31日」としか読まれない。
    // 一覧に日付だけのリンクが並んでも行き先が分からないので aria-label で補う
    const link = screen.getByRole('link', { name: /テスト太郎/ })
    expect(link).toHaveAttribute('href', '/posts/post-1')
    // 画面に出ている日付をそのまま読み上げに含める
    expect(link).toHaveAccessibleName(`テスト太郎 の投稿（${link.textContent?.trim()}）`)
  })

  describe('カードのどこを押しても投稿を開き、本文は選択できる（#198）', () => {
    afterEach(() => {
      vi.restoreAllMocks()
      window.getSelection()?.removeAllRanges()
    })

    it('本文を押すと投稿詳細へのリンクを押したことになる', () => {
      render(<PostCard post={basePost} />)
      const opened = openClicks()
      fireEvent.click(screen.getByText('これは試験投稿です。'))
      expect(opened).toHaveBeenCalledTimes(1)
    })

    it('このカードの本文を選択した直後のクリックでは開かない', () => {
      render(<PostCard post={basePost} />)
      const opened = openClicks()
      const text = screen.getByText('これは試験投稿です。')
      window.getSelection()!.selectAllChildren(text)
      fireEvent.click(text)
      expect(opened).not.toHaveBeenCalled()
    })

    it('カードの外に選択が残っていても、カードを押せば開く', () => {
      render(
        <>
          <p>カードの外の文</p>
          <PostCard post={basePost} />
        </>,
      )
      const opened = openClicks()
      window.getSelection()!.selectAllChildren(screen.getByText('カードの外の文'))
      fireEvent.click(screen.getByText('これは試験投稿です。'))
      expect(opened).toHaveBeenCalledTimes(1)
    })

    it('選択の範囲が複数あり、2 つ目以降がこのカードにあるときも開かない', () => {
      render(
        <>
          <p>カードの外の文</p>
          <PostCard post={basePost} />
        </>,
      )
      const opened = openClicks()
      const ranges = [
        rangeOf(screen.getByText('カードの外の文')),
        rangeOf(screen.getByText('これは試験投稿です。')),
      ]
      // jsdom は範囲を 1 つしか持てないので、Firefox の複数範囲の選択を作り込む
      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false,
        rangeCount: ranges.length,
        getRangeAt: (i: number) => ranges[i],
      } as unknown as Selection)
      fireEvent.click(screen.getByText('これは試験投稿です。'))
      expect(opened).not.toHaveBeenCalled()
    })

    it('中のリンクを押したときは、そのリンクだけが働く', () => {
      const post = { ...basePost, content: '参考: [リンク](https://example.com/a)' }
      render(<PostCard post={post} />)
      const opened = openClicks()
      for (const name of [/第1ニーファイ書/, 'リンク']) {
        const link = screen.getByRole('link', { name })
        link.addEventListener('click', (e) => e.preventDefault())
        fireEvent.click(link)
      }
      expect(opened).not.toHaveBeenCalled()
    })

    it.each(['metaKey', 'ctrlKey', 'shiftKey'])(
      '%s を押したままのクリックは新しいタブで開く',
      (key) => {
        render(<PostCard post={basePost} />)
        const opened = openClicks()
        const open = vi.spyOn(window, 'open').mockReturnValue(null)
        fireEvent.click(screen.getByText('これは試験投稿です。'), { [key]: true })
        expect(open).toHaveBeenCalledWith(
          expect.stringContaining('/posts/post-1'),
          '_blank',
          'noopener',
        )
        expect(opened).not.toHaveBeenCalled()
      },
    )

    describe('カード全体で投稿詳細を先読みする', () => {
      afterEach(() => {
        vi.useRealTimers()
        preloadRoute.mockClear()
      })

      it('マウスを乗せて少し待つと先読みする', () => {
        vi.useFakeTimers()
        render(<PostCard post={basePost} />)
        fireEvent.mouseEnter(screen.getByRole('article'))
        expect(preloadRoute).not.toHaveBeenCalled()
        vi.advanceTimersByTime(50)
        expect(preloadRoute).toHaveBeenCalledWith({ to: '/posts/$id', params: { id: 'post-1' } })
      })

      it('すぐに離れたら先読みしない', () => {
        vi.useFakeTimers()
        render(<PostCard post={basePost} />)
        fireEvent.mouseEnter(screen.getByRole('article'))
        fireEvent.mouseLeave(screen.getByRole('article'))
        vi.advanceTimersByTime(100)
        expect(preloadRoute).not.toHaveBeenCalled()
      })

      it('待っている間にカードが消えたら先読みしない', () => {
        vi.useFakeTimers()
        const { unmount } = render(<PostCard post={basePost} />)
        fireEvent.mouseEnter(screen.getByRole('article'))
        unmount()
        vi.advanceTimersByTime(100)
        expect(preloadRoute).not.toHaveBeenCalled()
      })

      it('指で触れたらすぐに先読みする', () => {
        render(<PostCard post={basePost} />)
        fireEvent.touchStart(screen.getByRole('article'))
        expect(preloadRoute).toHaveBeenCalledTimes(1)
      })
    })
  })

  it('対話要素を入れ子にしない', () => {
    const post = { ...basePost, content: '本文 [リンク](https://example.com/a) のあと' }
    const { container } = render(<PostCard post={post} />)
    const SELECTOR =
      'a,button,input,select,textarea,[role="link"],[role="button"],[tabindex]:not([tabindex="-1"])'
    const interactive = container.querySelectorAll(SELECTOR)
    // 聖典バッジ・本文中リンク・日付の 3 つが揃った状態で見る
    expect(interactive.length).toBeGreaterThanOrEqual(3)
    for (const el of interactive) {
      // 自分自身より外側に対話要素があってはいけない
      expect(el.parentElement?.closest(SELECTOR)).toBeNull()
    }
  })

  it('聖典バッジを本物のリンクにする', () => {
    render(<PostCard post={basePost} />)
    const badge = screen.getByRole('link', { name: /第1ニーファイ書/ })
    expect(badge.tagName).toBe('A')
    expect(badge).toHaveAttribute('href', expect.stringContaining('churchofjesuschrist.org'))
    // 外部サイトなので別タブ。rel も付ける
    expect(badge).toHaveAttribute('target', '_blank')
    expect(badge).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('本文中のリンクも本物のリンクにする', () => {
    const post = { ...basePost, content: '参考: [リンク](https://example.com/a)' }
    render(<PostCard post={post} />)
    const link = screen.getByRole('link', { name: 'リンク' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', 'https://example.com/a')
    // 投稿者が書いた URL。外部へ出るので別タブにする
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})
