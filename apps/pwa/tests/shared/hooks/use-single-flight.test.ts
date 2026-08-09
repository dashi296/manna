import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSingleFlight } from '@/shared/hooks/use-single-flight'

describe('useSingleFlight', () => {
  it('初期状態では pending が false', () => {
    const { result } = renderHook(() => useSingleFlight())

    expect(result.current.pending).toBe(false)
  })

  // これが本題。再レンダーを挟まずに2回呼ぶのが実際の二度押しに相当する
  it('再レンダーを挟まずに 2 回 begin しても 2 回目は false', () => {
    const { result } = renderHook(() => useSingleFlight())

    let first = false
    let second = false
    act(() => {
      first = result.current.begin()
      second = result.current.begin()
    })

    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(result.current.pending).toBe(true)
  })

  it('end のあとは再び begin できる（失敗時の再試行）', () => {
    const { result } = renderHook(() => useSingleFlight())

    act(() => {
      result.current.begin()
    })
    act(() => {
      result.current.end()
    })
    expect(result.current.pending).toBe(false)

    let again = false
    act(() => {
      again = result.current.begin()
    })

    expect(again).toBe(true)
    expect(result.current.pending).toBe(true)
  })
})
