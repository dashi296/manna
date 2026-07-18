import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BottomNav } from '@/shared/ui/BottomNav'
const mockPathname = vi.fn(() => '/')

vi.mock('@tanstack/react-router', async () => {
  const { routerMock } = await import('../../helpers/tanstack')
  // ファクトリは mockPathname の初期化前に実行されるため、ラムダで遅延参照する
  return routerMock(undefined, () => mockPathname())
})

describe('BottomNav', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/')
  })

  it('5つのナビアイテムをレンダーする', () => {
    render(<BottomNav />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
  })

  it('フィードリンクが "/" に向く', () => {
    render(<BottomNav />)
    const feedLink = screen.getByRole('link', { name: /フィード/ })
    expect(feedLink).toHaveAttribute('href', '/')
  })

  it('現在のパスが "/" のとき フィードリンクはアクティブクラスを持つ', () => {
    mockPathname.mockReturnValue('/')
    render(<BottomNav />)
    const feedLink = screen.getByRole('link', { name: /フィード/ })
    expect(feedLink.className).toContain('text-lagoon-deep')
  })

  it('現在のパスが "/scriptures" のとき 聖典リンクはアクティブクラスを持つ', () => {
    mockPathname.mockReturnValue('/scriptures')
    render(<BottomNav />)
    const scriptureLink = screen.getByRole('link', { name: /聖典/ })
    expect(scriptureLink.className).toContain('text-lagoon-deep')
  })

  it('非アクティブリンクはアクティブクラスを持たない', () => {
    mockPathname.mockReturnValue('/')
    render(<BottomNav />)
    const scriptureLink = screen.getByRole('link', { name: /聖典/ })
    expect(scriptureLink.className).not.toContain('text-lagoon-deep')
  })

  it('/scriptures/bofm は聖典リンクをアクティブにする（前方一致）', () => {
    mockPathname.mockReturnValue('/scriptures/bofm')
    render(<BottomNav />)
    const scriptureLink = screen.getByRole('link', { name: /聖典/ })
    expect(scriptureLink.className).toContain('text-lagoon-deep')
  })
})
