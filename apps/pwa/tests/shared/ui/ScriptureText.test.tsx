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

  it('showNumber=false のとき節番号を表示しない', () => {
    render(<ScriptureText verse={7} textHtml="テキスト" showNumber={false} />)
    expect(screen.queryByText('7')).toBeNull()
  })

  it('textHtmlSecondary 指定時は第2言語のテキストも lang 属性付きで表示する', () => {
    const { container } = render(
      <ScriptureText
        verse={1}
        textHtml="日本語のテキスト"
        textHtmlSecondary="English text"
        secondaryLang="en"
      />
    )
    expect(screen.getByText('日本語のテキスト')).toBeInTheDocument()
    expect(screen.getByText('English text')).toBeInTheDocument()
    const secondary = container.querySelector('[lang="en"]')
    expect(secondary).not.toBeNull()
    expect(secondary?.textContent).toBe('English text')
  })

  it('textHtmlSecondary が無ければ第2言語ブロックを描画しない', () => {
    const { container } = render(<ScriptureText verse={1} textHtml="日本語のテキスト" />)
    expect(container.querySelector('[lang]')).toBeNull()
  })

  it('textHtmlSecondary が無ければ本文を余分な div で包まない', () => {
    render(<ScriptureText verse={7} textHtml="テキスト" />)
    const numberSpan = screen.getByText('7')
    expect(numberSpan.nextElementSibling?.tagName).toBe('SPAN')
  })
})
