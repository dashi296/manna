import { describe, it, expect, vi } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
// invalidateRelationQueries はスライス内部専用でバレルに出していないため直接読む
import * as relationQueries from '@/entities/user/model/relationQueries'

// キーを1つ足して無効化への追加を忘れる事故を防ぐ。実際 PR #88 のレビューで、
// 投稿を別キーへ切り出したときにこれが起きた。
// 列挙を手書きすると同じ忘れ方ができるので、エクスポートから自動で拾う
const keyBuilders = Object.entries(relationQueries)
  .filter(([name, value]) => name.endsWith('Key') && typeof value === 'function')
  .map(([name, value]) => [name, value as (...args: string[]) => unknown[]] as const)

const invalidatedPrefixes = async () => {
  const invalidateQueries = vi.fn().mockResolvedValue(undefined)
  await relationQueries.invalidateRelationQueries({ invalidateQueries } as unknown as QueryClient)
  return invalidateQueries.mock.calls.map((call) => call[0].queryKey)
}

describe('invalidateRelationQueries', () => {
  it('エクスポートされているキービルダーのプレフィックスをすべて落とす', async () => {
    const prefixes = (await invalidatedPrefixes()).map(([head]) => head)

    expect(keyBuilders.length).toBeGreaterThan(0)
    for (const [name, build] of keyBuilders) {
      const [head] = build('a', 'b')
      expect(prefixes, `${name} が無効化対象に入っていない`).toContain(head)
    }
  })

  it('プレフィックスだけを渡す（userId 単位に絞らない）', async () => {
    for (const queryKey of await invalidatedPrefixes()) {
      expect(queryKey).toHaveLength(1)
    }
  })
})
