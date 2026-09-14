import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createOutcome } from './fetch-outcome.mjs'

describe('createOutcome', () => {
  it('何も失敗しなければ終了コードは 0', () => {
    const outcome = createOutcome()
    assert.strictEqual(outcome.exitCode, 0)
  })

  it('1章でも例外になれば 1。不完全なまま seed の書き出しや本番投入へ進めない', () => {
    const outcome = createOutcome()
    outcome.recordError()
    assert.strictEqual(outcome.failed, 1)
    assert.strictEqual(outcome.exitCode, 1)
  })

  it('見出しが取れない章は失敗として数える（取得元のマークアップ変更を検知する）', () => {
    const outcome = createOutcome()
    assert.strictEqual(outcome.recordHeading({ isFrontMatter: false, heading: null }), true)
    assert.strictEqual(outcome.exitCode, 1)
  })

  it('見出しが取れていれば数えない', () => {
    const outcome = createOutcome()
    assert.strictEqual(outcome.recordHeading({ isFrontMatter: false, heading: { title: '第1章' } }), false)
    assert.strictEqual(outcome.exitCode, 0)
  })

  it('前付け文書には章のタイトルが無いので対象外', () => {
    const outcome = createOutcome()
    assert.strictEqual(outcome.recordHeading({ isFrontMatter: true, heading: null }), false)
    assert.strictEqual(outcome.exitCode, 0)
  })
})
