import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownRenderer } from '@/shared/ui/MarkdownRenderer'

describe('MarkdownRenderer', () => {
  it('Markdown テキストを HTML にレンダーする', () => {
    render(<MarkdownRenderer content="**太字テスト**" />)
    const strong = screen.getByText('太字テスト')
    expect(strong.tagName).toBe('STRONG')
  })

  it('GFM のテーブルをレンダーする', () => {
    const table = '| A | B |\n|---|---|\n| 1 | 2 |'
    const { container } = render(<MarkdownRenderer content={table} />)
    expect(container.querySelector('table')).not.toBeNull()
  })

  it('className を適用する', () => {
    const { container } = render(<MarkdownRenderer content="hello" className="prose" />)
    expect(container.firstElementChild?.className).toContain('prose')
  })

  it('空文字列でもエラーにならない', () => {
    const { container } = render(<MarkdownRenderer content="" />)
    expect(container).toBeTruthy()
  })
})
