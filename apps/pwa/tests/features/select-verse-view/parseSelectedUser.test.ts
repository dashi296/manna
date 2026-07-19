import { describe, it, expect } from 'vitest'
import { parseSelectedUser } from '@/features/select-verse-view/model/parseSelectedUser'

describe('parseSelectedUser', () => {
  it('妥当な UUID 文字列は通す', () => {
    expect(parseSelectedUser('83e6c067-306b-4981-b957-98e2b4b74460')).toBe(
      '83e6c067-306b-4981-b957-98e2b4b74460',
    )
  })
  it('undefined は undefined', () => {
    expect(parseSelectedUser(undefined)).toBeUndefined()
  })
  it('空文字は undefined', () => {
    expect(parseSelectedUser('')).toBeUndefined()
  })
  it('不正文字を含むと undefined', () => {
    expect(parseSelectedUser('bogus user id')).toBeUndefined()
    expect(parseSelectedUser('<script>')).toBeUndefined()
  })
  it('非文字列は undefined', () => {
    expect(parseSelectedUser(null)).toBeUndefined()
    expect(parseSelectedUser(123)).toBeUndefined()
  })
  it('長すぎる文字列は undefined', () => {
    expect(parseSelectedUser('a'.repeat(37))).toBeUndefined()
  })
})
