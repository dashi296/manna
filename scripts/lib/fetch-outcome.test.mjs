import { describe, it } from 'node:test'
import assert from 'node:assert'
import { exitCodeFor } from './fetch-outcome.mjs'

describe('exitCodeFor', () => {
  it('全章そろっていれば 0', () => {
    assert.strictEqual(exitCodeFor({ failed: 0 }), 0)
  })

  it('1章でも失敗していれば 1。不完全なまま seed の書き出しや本番投入へ進めない', () => {
    assert.strictEqual(exitCodeFor({ failed: 1 }), 1)
  })
})
