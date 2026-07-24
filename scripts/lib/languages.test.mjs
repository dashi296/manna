import { describe, it } from 'node:test'
import assert from 'node:assert'
import { resolveLanguage } from './languages.mjs'

describe('resolveLanguage', () => {
  it('ja を教会公式APIの言語コード jpn に解決する', () => {
    assert.deepStrictEqual(resolveLanguage('ja'), { code: 'ja', apiCode: 'jpn', label: '日本語' })
  })

  it('en を教会公式APIの言語コード eng に解決する', () => {
    assert.deepStrictEqual(resolveLanguage('en'), { code: 'en', apiCode: 'eng', label: 'English' })
  })

  it('未登録の言語コードはエラーを投げる', () => {
    assert.throws(() => resolveLanguage('fr'), /Unknown language code: fr/)
  })
})
