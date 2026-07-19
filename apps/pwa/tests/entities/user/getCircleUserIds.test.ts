import { describe, it, expect, vi } from 'vitest'
import { getCircleUserIds } from '@/entities/user/lib/getCircleUserIds'

function makeSupabase({
  follows,
  family,
  users,
}: {
  follows: { following_id: string }[]
  family: { requester_id: string; addressee_id: string }[]
  users: { id: string; display_name: string | null; avatar_url: string | null }[]
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'follows') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: follows }),
          }),
        }
      }
      if (table === 'family_relationships') {
        return {
          select: () => ({
            eq: () => ({
              or: () => Promise.resolve({ data: family }),
            }),
          }),
        }
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) =>
              Promise.resolve({
                data: users.filter((u) => ids.includes(u.id)),
              }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    }),
  }
}

describe('getCircleUserIds', () => {
  it('自分 + フォロー + 家族(accepted) を dedup した ID とレコードを返す', async () => {
    const supabase = makeSupabase({
      follows: [{ following_id: 'follow-a' }, { following_id: 'shared' }],
      family: [
        { requester_id: 'me', addressee_id: 'family-a' },
        { requester_id: 'shared', addressee_id: 'me' },
      ],
      users: [
        { id: 'me', display_name: '私', avatar_url: null },
        { id: 'follow-a', display_name: 'A', avatar_url: null },
        { id: 'family-a', display_name: 'B', avatar_url: null },
        { id: 'shared', display_name: 'C', avatar_url: null },
      ],
    })

    const result = await getCircleUserIds(
      supabase as unknown as Parameters<typeof getCircleUserIds>[0],
      'me',
    )

    expect(new Set(result.ids)).toEqual(new Set(['me', 'follow-a', 'family-a', 'shared']))
    expect(result.users.map((u) => u.id).sort()).toEqual(
      ['follow-a', 'family-a', 'me', 'shared'].sort(),
    )
  })

  it('follows / family が null の場合でも self だけの結果を返す', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'follows') {
          return { select: () => ({ eq: () => Promise.resolve({ data: null }) }) }
        }
        if (table === 'family_relationships') {
          return {
            select: () => ({
              eq: () => ({ or: () => Promise.resolve({ data: null }) }),
            }),
          }
        }
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [{ id: 'me', display_name: '私', avatar_url: null }],
              }),
          }),
        }
      }),
    }

    const result = await getCircleUserIds(
      supabase as unknown as Parameters<typeof getCircleUserIds>[0],
      'me',
    )
    expect(result.ids).toEqual(['me'])
    expect(result.users).toHaveLength(1)
  })
})
