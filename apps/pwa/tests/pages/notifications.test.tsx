import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { routeComponent } from '../helpers/tanstack'

const update = vi.fn()
const inFn = vi.fn()

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (...args: unknown[]) => {
        update(...args)
        return {
          in: (...a: unknown[]) => {
            inFn(...a)
            return Promise.resolve({ error: null })
          },
        }
      },
    }),
  },
}))

let loaderData: unknown[] = []

vi.mock('@tanstack/react-router', async () =>
  (await import('../helpers/tanstack')).routerMock(() => loaderData),
)

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({ handler: (fn: unknown) => fn }),
}))

const row = (id: string, read: boolean) => ({
  id,
  type: 'liked' as const,
  read,
  created_at: '2026-09-01T00:00:00.000Z',
  post_id: 'p1',
  actor_id: 'u2',
  users: { display_name: '相手', avatar_url: null },
})

const NotificationsPage = routeComponent(await import('@/pages/notifications'))

describe('通知ページの既読化', () => {
  beforeEach(() => {
    update.mockClear()
    inFn.mockClear()
  })

  it('未読があれば既読にする', async () => {
    loaderData = [row('n1', false), row('n2', true)]
    render(<NotificationsPage />)

    await waitFor(() => expect(inFn).toHaveBeenCalledWith('id', ['n1']))
    // 何を書き込むかも固定する（{ read: false } などへの変異を検出する）
    expect(update).toHaveBeenCalledWith({ read: true })
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('未読が無ければリクエストを送らない', async () => {
    loaderData = [row('n1', true)]
    render(<NotificationsPage />)

    await new Promise((r) => setTimeout(r, 20))
    expect(update).not.toHaveBeenCalled()
  })

  // 同じデータのまま再描画されても送り直さない。依存に notifications を入れるので、
  // loader の参照が安定していることが前提になる
  it('同じデータで再描画しても既読リクエストは 1 回だけ', async () => {
    loaderData = [row('n1', false)]
    const { rerender } = render(<NotificationsPage />)
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))

    rerender(<NotificationsPage />)
    rerender(<NotificationsPage />)
    await new Promise((r) => setTimeout(r, 20))

    expect(update).toHaveBeenCalledTimes(1)
  })

  // 後から届いた未読も既読にする（[] 固定だと取りこぼす）
  it('再取得で新しい未読が増えたら、それも既読にする', async () => {
    loaderData = [row('n1', true)]
    const { rerender } = render(<NotificationsPage />)
    await new Promise((r) => setTimeout(r, 20))
    expect(update).not.toHaveBeenCalled()

    loaderData = [row('n1', true), row('n2', false)]
    rerender(<NotificationsPage />)

    await waitFor(() => expect(inFn).toHaveBeenCalledWith('id', ['n2']))
  })
})
