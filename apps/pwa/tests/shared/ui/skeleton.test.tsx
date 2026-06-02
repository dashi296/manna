import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton, PostCardSkeleton } from '@/shared/ui/skeleton'

describe('Skeleton', () => {
  it('animate-pulse クラスを持つ div をレンダーする', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el.className).toContain('animate-pulse')
  })

  it('追加クラスを受け付ける', () => {
    const { container } = render(<Skeleton className="w-10 h-10" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('w-10')
    expect(el.className).toContain('h-10')
  })
})

describe('PostCardSkeleton', () => {
  it('複数の Skeleton 要素をレンダーする', () => {
    const { container } = render(<PostCardSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })
})
