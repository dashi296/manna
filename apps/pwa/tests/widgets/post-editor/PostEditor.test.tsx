import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PostEditor } from '@/widgets/post-editor'

const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })
const mockNavigate = vi.fn()

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: mockInsert }),
    auth: { getUser: () => mockGetUser() },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

describe('PostEditor', () => {
  beforeEach(() => {
    localStorage.clear()
    mockInsert.mockClear()
    mockNavigate.mockClear()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  })

  it('mode="page" 時、投稿成功で navigate({to:"/"}) される', async () => {
    const user = userEvent.setup()
    render(<PostEditor />)
    await user.type(screen.getByPlaceholderText(/感じたこと/), 'テスト投稿')
    await user.click(screen.getByRole('button', { name: '投稿する' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/' }))
  })

  it('mode="sheet" + onSuccess で navigate せず onSuccess が呼ばれる', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<PostEditor mode="sheet" onSuccess={onSuccess} />)
    await user.type(screen.getByPlaceholderText(/感じたこと/), 'シートから投稿')
    await user.click(screen.getByRole('button', { name: '投稿する' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('初期節参照で下書きキーが分離される', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <PostEditor
        mode="sheet"
        onSuccess={() => {}}
        initialScripture={{ collection: 'bofm', book: 'mosiah', chapter: 3, verses: [19] }}
      />,
    )
    await user.type(screen.getByPlaceholderText(/感じたこと/), '19節への感想')

    await waitFor(() =>
      expect(localStorage.getItem('manna:post-draft:bofm:mosiah:3:19')).toContain('19節への感想'),
    )
    expect(localStorage.getItem('manna:post-draft:bofm:mosiah:3:20')).toBeNull()
    expect(localStorage.getItem('manna:post-draft')).toBeNull()
    unmount()
  })

  it('未ログイン時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup()
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    render(<PostEditor mode="sheet" onSuccess={() => {}} />)
    await user.type(screen.getByPlaceholderText(/感じたこと/), 'ログインなし')
    await user.click(screen.getByRole('button', { name: '投稿する' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/ログインが必要/)
  })

  it('投稿失敗時にエラーメッセージが表示され、シートは閉じない (onSuccess 未呼び出し)', async () => {
    const user = userEvent.setup()
    mockInsert.mockResolvedValueOnce({ error: { message: 'insert failed' } })
    const onSuccess = vi.fn()
    render(<PostEditor mode="sheet" onSuccess={onSuccess} />)
    await user.type(screen.getByPlaceholderText(/感じたこと/), 'エラーになる')
    await user.click(screen.getByRole('button', { name: '投稿する' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/投稿に失敗/)
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
