import { describe, expect, it } from 'vitest'
import { resolveQueryLanguages } from '@/pages/scriptures/$collection/$book/$chapter'
import { SECONDARY_LANGUAGE } from '@/shared/config/scriptureLanguage'

describe('resolveQueryLanguages', () => {
  it('returns only Japanese when bilingual is false', () => {
    expect(resolveQueryLanguages(false)).toEqual(['ja'])
  })

  it('returns Japanese and the secondary language when bilingual is true', () => {
    expect(resolveQueryLanguages(true)).toEqual(['ja', SECONDARY_LANGUAGE])
  })
})
