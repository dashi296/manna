import { describe, it, expect, vi } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
// invalidateRelationQueries はスライス内部専用でバレルに出していないため直接読む
import {
  connectionsKey,
  feedKey,
  invalidateRelationQueries,
  profileKey,
  userPostsKey,
} from '@/entities/user/model/relationQueries'

// キーを1つ足して無効化への追加を忘れる事故を防ぐ。実際 PR #88 のレビューで、
// 投稿を別キーへ切り出したときにこれが起きた
describe('invalidateRelationQueries', () => {
  it('関係で古くなるキーのプレフィックスをすべて落とす', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    await invalidateRelationQueries({ invalidateQueries } as unknown as QueryClient)

    const invalidated = invalidateQueries.mock.calls.map((c) => c[0].queryKey[0])
    const gated = [
      profileKey('u1'),
      connectionsKey('u1', 'followers'),
      userPostsKey('u1'),
      feedKey('following'),
    ]
    for (const [prefix] of gated) {
      expect(invalidated).toContain(prefix)
    }
  })

  it('プレフィックスだけを渡す（userId 単位に絞らない）', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    await invalidateRelationQueries({ invalidateQueries } as unknown as QueryClient)

    for (const [{ queryKey }] of invalidateQueries.mock.calls) {
      expect(queryKey).toHaveLength(1)
    }
  })
})
