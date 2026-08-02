import { describe, it, expect, vi } from 'vitest'
import { getCircleUserIds } from '@/entities/user/lib/getCircleUserIds'
import { createSupabaseQueryChain } from '../../helpers/supabase'

type Row = Record<string, unknown>

type Response = { data?: Row[] | null; error?: unknown }

function makeSupabase(responses: { follows: Response; family: Response; users: Response }) {
  const byTable: Record<string, Response> = {
    follows: responses.follows,
    family_relationships: responses.family,
    users: responses.users,
  }
  return {
    from: vi.fn((table: string) => {
      const res = byTable[table]
      if (!res) throw new Error(`unexpected table ${table}`)
      return createSupabaseQueryChain(() => res)
    }),
  }
}

const call = (supabase: ReturnType<typeof makeSupabase>) =>
  getCircleUserIds(supabase as unknown as Parameters<typeof getCircleUserIds>[0], 'me')

describe('getCircleUserIds', () => {
  it('自分 + フォロー + 家族(accepted) を dedup', async () => {
    const result = await call(
      makeSupabase({
        follows: { data: [{ following_id: 'follow-a' }, { following_id: 'shared' }] },
        family: {
          data: [
            { requester_id: 'me', addressee_id: 'family-a' },
            { requester_id: 'shared', addressee_id: 'me' },
          ],
        },
        users: {
          data: [
            { id: 'me', display_name: '私', avatar_url: null },
            { id: 'follow-a', display_name: 'A', avatar_url: null },
            { id: 'family-a', display_name: 'B', avatar_url: null },
            { id: 'shared', display_name: 'C', avatar_url: null },
          ],
        },
      }),
    )
    expect(new Set(result.ids)).toEqual(new Set(['me', 'follow-a', 'family-a', 'shared']))
    expect(result.users).toHaveLength(4)
  })

  it('follows の取得が失敗したら投げる（0件として扱わない）', async () => {
    await expect(
      call(
        makeSupabase({
          follows: { data: null, error: { message: 'boom' } },
          family: { data: [] },
          users: { data: [] },
        }),
      ),
    ).rejects.toMatchObject({ message: 'boom' })
  })

  it('関係が0件なら self だけ返す', async () => {
    const result = await call(
      makeSupabase({
        follows: { data: [] },
        family: { data: [] },
        users: { data: [{ id: 'me', display_name: '私', avatar_url: null }] },
      }),
    )
    expect(result.ids).toEqual(['me'])
    expect(result.users).toHaveLength(1)
  })
})
