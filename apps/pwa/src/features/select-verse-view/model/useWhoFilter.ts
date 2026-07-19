import { useCallback, useEffect, useState } from 'react'

export const WHO_FILTER_STORAGE_KEY = 'manna:verseWhoFilter:v1'

type Stored = { excluded: string[] }

function readStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(WHO_FILTER_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as Stored
    if (!Array.isArray(parsed?.excluded)) return new Set()
    return new Set(parsed.excluded.filter((v) => typeof v === 'string'))
  } catch {
    return new Set()
  }
}

function writeStorage(excluded: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    const value: Stored = { excluded: [...excluded] }
    window.localStorage.setItem(WHO_FILTER_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // ignore quota / private-mode errors
  }
}

export function useWhoFilter() {
  const [excluded, setExcluded] = useState<Set<string>>(() => readStorage())

  useEffect(() => {
    writeStorage(excluded)
  }, [excluded])

  const toggle = useCallback((userId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }, [])

  const setAll = useCallback((userIds: string[], include: boolean) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      for (const id of userIds) {
        if (include) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }, [])

  const isIncluded = useCallback((userId: string) => !excluded.has(userId), [excluded])

  return { excluded, toggle, setAll, isIncluded }
}
