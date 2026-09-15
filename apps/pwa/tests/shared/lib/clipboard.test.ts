import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyText } from '@/shared/lib/clipboard'

function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('copyText', () => {
  it('書き込めたら true を返す', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)

    await expect(copyText('第1ニーファイ書 1:3')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('第1ニーファイ書 1:3')
  })

  it('拒否されたら false を返す（例外は投げない）', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))

    await expect(copyText('本文')).resolves.toBe(false)
  })

  it('クリップボードが無い環境では false を返す', async () => {
    await expect(copyText('本文')).resolves.toBe(false)
  })
})
