import { useEffect, useState } from 'react'

// SSR / hydration safety: returns false on the server and during the first
// client render, true after mount. Use to gate reads from client-only state
// (localStorage, window, etc.) so SSR HTML and first client render agree.
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}
