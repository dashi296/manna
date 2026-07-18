import { describe, it, expect } from 'vitest'
import { sidebarStateFromCookieHeader } from '@/shared/ui/sidebar'

// vendored ファイル内の独自追加（upstream に存在しない）ため、
// shadcn 再同期で消えた場合に検知できるようテストで固定する
describe('sidebarStateFromCookieHeader', () => {
  it('cookie が無い場合は true（デフォルト開）', () => {
    expect(sidebarStateFromCookieHeader('')).toBe(true)
  })

  it('sidebar_state=false のとき false', () => {
    expect(sidebarStateFromCookieHeader('sidebar_state=false')).toBe(false)
  })

  it('sidebar_state=true のとき true', () => {
    expect(sidebarStateFromCookieHeader('sidebar_state=true')).toBe(true)
  })

  it('複数 cookie の中からでも読み取れる', () => {
    expect(sidebarStateFromCookieHeader('a=1; sidebar_state=false; b=2')).toBe(false)
  })

  it('名前が部分一致するだけの cookie には反応しない', () => {
    expect(sidebarStateFromCookieHeader('other_sidebar_state=false')).toBe(true)
  })
})
