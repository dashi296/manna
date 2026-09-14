import { describe, it, expect } from 'vitest'
import { buildChapterItems } from '@/features/select-scripture'

describe('buildChapterItems', () => {
  it('front matter の書は書名1件のみを返す', () => {
    const items = buildChapterItems({ chapters: 1, name: '序文', isFrontMatter: true })
    expect(items).toEqual([{ value: '1', label: '序文' }])
  })

  it('詩篇は「第n篇」。章の呼び方は getChapterLabel に一本化する', () => {
    const items = buildChapterItems({ chapters: 2, name: '詩篇', chapterUnit: '篇' })
    expect(items).toEqual([
      { value: '1', label: '第1篇' },
      { value: '2', label: '第2篇' },
    ])
  })

  it('通常の書は章番号ラベルを章数ぶん返す', () => {
    const items = buildChapterItems({ chapters: 3, name: 'ヤコブ書' })
    expect(items).toEqual([
      { value: '1', label: '第1章' },
      { value: '2', label: '第2章' },
      { value: '3', label: '第3章' },
    ])
  })
})
