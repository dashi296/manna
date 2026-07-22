import { useEffect, useLayoutEffect, useState } from 'react'

// useLayoutEffect fires before paint, so the mounted flip happens before the
// browser shows a frame — avoiding the one-frame flicker useEffect causes.
// Falls back to useEffect on the server, where useLayoutEffect warns.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

// SSR / hydration safety: returns false on the server and during the first
// client render, true after mount. Use to gate reads from client-only state
// (localStorage, window, etc.) so SSR HTML and first client render agree.
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useIsomorphicLayoutEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}
