import { describe, it, expect } from 'vitest'
import { resolveUserIdentity, ANONYMOUS_DISPLAY_NAME } from '@/shared/lib/constants'

describe('resolveUserIdentity', () => {
  it('display_nameとavatar_urlを返す', () => {
    const result = resolveUserIdentity({
      display_name: 'Alice',
      avatar_url: 'https://example.com/avatar.png',
    })
    expect(result).toEqual({
      displayName: 'Alice',
      avatarUrl: 'https://example.com/avatar.png',
    })
  })

  it('userがnullの場合は匿名ユーザーとnullを返す', () => {
    const result = resolveUserIdentity(null)
    expect(result).toEqual({
      displayName: ANONYMOUS_DISPLAY_NAME,
      avatarUrl: null,
    })
  })

  it('display_nameがnullの場合は匿名ユーザーにフォールバックする', () => {
    const result = resolveUserIdentity({ display_name: null, avatar_url: 'url' })
    expect(result.displayName).toBe(ANONYMOUS_DISPLAY_NAME)
    expect(result.avatarUrl).toBe('url')
  })

  it('avatar_urlがnullの場合はnullを返す', () => {
    const result = resolveUserIdentity({ display_name: 'Bob', avatar_url: null })
    expect(result.displayName).toBe('Bob')
    expect(result.avatarUrl).toBeNull()
  })
})
