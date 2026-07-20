import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMounted } from '@/shared/hooks/use-mounted'

describe('useMounted', () => {
  it('初期レンダーでは false', () => {
    let firstRender: boolean | null = null
    renderHook(() => {
      const value = useMounted()
      if (firstRender === null) firstRender = value
      return value
    })
    expect(firstRender).toBe(false)
  })

  it('マウント後に true になる', async () => {
    const { result } = renderHook(() => useMounted())
    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })
})
