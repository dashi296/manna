import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScriptureText } from '@/shared/ui/ScriptureText'

describe('ScriptureText', () => {
  it('節番号とテキストを表示する', () => {
    render(<ScriptureText verse={7} textHtml="わたしに<ruby><rb>尋</rb><rt>たず</rt></ruby>ねなさい" />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('ruby タグを保持し HTML として描画する', () => {
    const { container } = render(
      <ScriptureText verse={1} textHtml="<ruby><rb>善</rb><rt>よ</rt></ruby>い" />
    )
    const ruby = container.querySelector('ruby')
    expect(ruby).not.toBeNull()
  })

  it('危険な HTML タグを除去する', () => {
    const { container } = render(
      <ScriptureText verse={1} textHtml='テスト<script>alert("xss")</script>テキスト' />
    )
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText(/テスト/)).toBeInTheDocument()
  })
})
