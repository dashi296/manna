import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/shared/ui/PageHeader'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

describe('PageHeader', () => {
  it('タイトルを表示する', () => {
    render(<PageHeader title="テストページ" />)
    expect(screen.getByRole('heading', { name: 'テストページ' })).toBeInTheDocument()
  })

  it('backTo が指定されると戻るリンクを表示する', () => {
    render(<PageHeader title="詳細" backTo="/scriptures" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/scriptures')
  })

  it('backTo がないとリンクを表示しない', () => {
    render(<PageHeader title="フィード" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('backLabel を表示する', () => {
    render(<PageHeader title="詳細" backTo="/" backLabel="戻る" />)
    expect(screen.getByText('戻る')).toBeInTheDocument()
  })

  it('action スロットをレンダーする', () => {
    render(<PageHeader title="投稿" action={<button>送信</button>} />)
    expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
  })

  it('タイトルの上にセーフエリア分の上部パディングクラスが付与される', () => {
    render(<PageHeader title="テストページ" />)
    const heading = screen.getByRole('heading', { name: 'テストページ' })
    const header = heading.closest('header')
    expect(header?.className).toContain('pt-[var(--page-header-pt)]')
  })

  it('タイトルが中央のカラムに置かれる', () => {
    render(<PageHeader title="第5章" />)
    const heading = screen.getByRole('heading', { name: '第5章' })
    const header = heading.closest('header')
    expect(header?.className).toContain('grid-cols-[1fr_auto_1fr]')
    expect(heading.className).toContain('text-center')
    expect(heading.className).toContain('truncate')
  })

  it('戻るリンクや操作が無くてもタイトルの左右にカラムを確保する', () => {
    render(<PageHeader title="聖典" />)
    const heading = screen.getByRole('heading', { name: '聖典' })
    const header = heading.closest('header')
    expect(header?.children.length).toBe(3)
    expect(header?.children[1]).toBe(heading)
  })
})
