import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useWhoFilter,
  WHO_FILTER_STORAGE_KEY,
} from '@/features/select-verse-view/model/useWhoFilter'

describe('useWhoFilter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('初期状態は excluded が空で、全員 isIncluded=true', () => {
    const { result } = renderHook(() => useWhoFilter())
    expect(result.current.excluded.size).toBe(0)
    expect(result.current.isIncluded('anyone')).toBe(true)
  })

  it('toggle でユーザーを excluded に加える／外す', () => {
    const { result } = renderHook(() => useWhoFilter())
    act(() => result.current.toggle('u1'))
    expect(result.current.isIncluded('u1')).toBe(false)
    act(() => result.current.toggle('u1'))
    expect(result.current.isIncluded('u1')).toBe(true)
  })

  it('toggle 後の状態を localStorage に保存する', () => {
    const { result } = renderHook(() => useWhoFilter())
    act(() => result.current.toggle('u1'))
    const stored = JSON.parse(localStorage.getItem(WHO_FILTER_STORAGE_KEY) ?? 'null')
    expect(stored).toEqual({ excluded: ['u1'] })
  })

  it('setAll(ids, false) で指定 ID をすべて excluded に、setAll(ids, true) で外す', () => {
    const { result } = renderHook(() => useWhoFilter())
    act(() => result.current.setAll(['a', 'b', 'c'], false))
    expect(result.current.isIncluded('a')).toBe(false)
    expect(result.current.isIncluded('b')).toBe(false)
    act(() => result.current.setAll(['a', 'b'], true))
    expect(result.current.isIncluded('a')).toBe(true)
    expect(result.current.isIncluded('c')).toBe(false)
  })

  it('起動時に localStorage の内容を復元する', () => {
    localStorage.setItem(
      WHO_FILTER_STORAGE_KEY,
      JSON.stringify({ excluded: ['u9'] }),
    )
    const { result } = renderHook(() => useWhoFilter())
    expect(result.current.isIncluded('u9')).toBe(false)
    expect(result.current.isIncluded('u1')).toBe(true)
  })

  it('壊れた localStorage 値は無視して空 excluded で開始する', () => {
    localStorage.setItem(WHO_FILTER_STORAGE_KEY, 'not-json')
    const { result } = renderHook(() => useWhoFilter())
    expect(result.current.excluded.size).toBe(0)
  })
})
