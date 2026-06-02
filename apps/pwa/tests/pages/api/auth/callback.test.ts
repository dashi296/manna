import { describe, it, expect } from 'vitest'
import { isCodeReuseError } from '@/shared/lib/auth'

describe('isCodeReuseError', () => {
  it('otp_expired を含むエラーメッセージを認識する', () => {
    expect(isCodeReuseError(new Error('otp_expired'))).toBe(true)
  })

  it('invalid_grant を含むエラーメッセージを認識する', () => {
    expect(isCodeReuseError(new Error('invalid_grant'))).toBe(true)
  })

  it('invalid request を含むエラーメッセージを認識する', () => {
    expect(isCodeReuseError(new Error('invalid request'))).toBe(true)
  })

  it('大文字小文字を区別しない', () => {
    expect(isCodeReuseError(new Error('OTP_EXPIRED'))).toBe(true)
  })

  it('文字列エラーも処理できる', () => {
    expect(isCodeReuseError('otp_expired error occurred')).toBe(true)
  })

  it('無関係なエラーは false を返す', () => {
    expect(isCodeReuseError(new Error('network error'))).toBe(false)
  })

  it('null/undefined は false を返す', () => {
    expect(isCodeReuseError(null)).toBe(false)
    expect(isCodeReuseError(undefined)).toBe(false)
  })
})
