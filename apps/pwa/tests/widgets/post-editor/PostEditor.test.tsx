import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PostEditor } from '@/widgets/post-editor'

const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })
const mockNavigate = vi.fn()

// update は .eq('id', ...).select('id') で終わる。引数を検証したいので eq もスパイする
const mockUpdate = vi.fn()
const mockUpdateEq = vi.fn()
const mockUpdateResult = vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null })

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      update: (values: unknown) => {
        mockUpdate(values)
        return {
          eq: (column: string, value: unknown) => {
            mockUpdateEq(column, value)
            return { select: () => mockUpdateResult() }
          },
        }
      },
    }),
    auth: { getUser: () => mockGetUser() },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

// describe をまたいで共有する。Vitest のフックは兄弟 describe に継承されないため、
// describe 内に置くと各 describe で複製することになる
beforeEach(() => {
  localStorage.clear()
  mockInsert.mockClear()
  mockNavigate.mockClear()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mockUpdate.mockClear()
  mockUpdateEq.mockClear()
  mockUpdateResult.mockClear().mockResolvedValue({ data: [{ id: 'p1' }], error: null })
})

describe('PostEditor', () => {
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
      expect(localStorage.getItem('manna:post-draft:v2:bofm:mosiah:3:19')).toContain('19節への感想'),
    )
    expect(localStorage.getItem('manna:post-draft:v2:bofm:mosiah:3:20')).toBeNull()
    expect(localStorage.getItem('manna:post-draft:v2')).toBeNull()
    unmount()
  })

  it('バージョンの合わない古い下書きを回収し、v2 のものは残す', async () => {
    localStorage.setItem('manna:post-draft', '{"content":"旧ページ用"}')
    localStorage.setItem('manna:post-draft:bofm:mosiah:3:19', '{"content":"旧シート用"}')
    localStorage.setItem('manna:post-draft:v2:bofm:mosiah:3:20', '{"content":"v2 の下書き"}')
    localStorage.setItem('manna:bookmarks:v1', '{"state":{}}')

    render(<PostEditor mode="sheet" onSuccess={() => {}} />)

    await waitFor(() => expect(localStorage.getItem('manna:post-draft')).toBeNull())
    expect(localStorage.getItem('manna:post-draft:bofm:mosiah:3:19')).toBeNull()
    // v2 と、そもそも下書きではないキーは触らない
    expect(localStorage.getItem('manna:post-draft:v2:bofm:mosiah:3:20')).toBe('{"content":"v2 の下書き"}')
    expect(localStorage.getItem('manna:bookmarks:v1')).toBe('{"state":{}}')
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

describe('PostEditor（編集モード）', () => {
  const editablePost = { id: 'p1', content: '元の本文', visibility: 'public' as const }
  const scripture = { collection: 'bofm', book: 'mosiah', chapter: 3, verses: [19] }

  it('post の内容を初期値として表示する', () => {
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={() => {}} />)

    expect(screen.getByPlaceholderText(/感じたこと/)).toHaveValue('元の本文')
  })

  // renderToStaticMarkup はレンダーフェーズだけを走らせ effect を実行しない。
  // 初期値を effect で流し込む実装に戻すと、本文が空になってここが落ちる
  it('初期レンダーの時点で post の内容が入っている', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server')

    const html = renderToStaticMarkup(
      <PostEditor mode="sheet" post={editablePost} onSuccess={() => {}} />,
    )

    expect(html).toContain('元の本文')
    expect(html).toContain('更新する')
  })

  it('ボタンのラベルが「更新する」になる', () => {
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={() => {}} />)

    expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '投稿する' })).toBeNull()
  })

  it('本文も公開範囲も変えていない間は更新できない', () => {
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={() => {}} />)

    expect(screen.getByRole('button', { name: '更新する' })).toBeDisabled()
  })

  it('localStorage の下書きを読まない', () => {
    localStorage.setItem(
      'manna:post-draft:v2:bofm:mosiah:3:19',
      JSON.stringify({ content: '書きかけの新規投稿', visibility: 'public', scripture }),
    )

    render(
      <PostEditor mode="sheet" post={editablePost} initialScripture={scripture} onSuccess={() => {}} />,
    )

    expect(screen.getByPlaceholderText(/感じたこと/)).toHaveValue('元の本文')
  })

  it('localStorage の下書きを書き換えない', async () => {
    const user = userEvent.setup()
    const draft = JSON.stringify({ content: '書きかけの新規投稿', visibility: 'public', scripture })
    localStorage.setItem('manna:post-draft:v2:bofm:mosiah:3:19', draft)

    render(
      <PostEditor mode="sheet" post={editablePost} initialScripture={scripture} onSuccess={() => {}} />,
    )
    await user.type(screen.getByPlaceholderText(/感じたこと/), '追記')

    // 新規投稿モードの保存は 500ms デバウンスされる。待たずに見ると
    // 「まだ書いていないだけ」を「書かない」と誤判定する
    await new Promise((resolve) => setTimeout(resolve, 700))

    expect(localStorage.getItem('manna:post-draft:v2:bofm:mosiah:3:19')).toBe(draft)
  })

  it('更新に成功しても下書きを消さない', async () => {
    const user = userEvent.setup()
    const draft = JSON.stringify({ content: '書きかけの新規投稿', visibility: 'public', scripture })
    localStorage.setItem('manna:post-draft:v2:bofm:mosiah:3:19', draft)
    const onSuccess = vi.fn()

    render(
      <PostEditor mode="sheet" post={editablePost} initialScripture={scripture} onSuccess={onSuccess} />,
    )
    await user.type(screen.getByPlaceholderText(/感じたこと/), 'を直した')
    await user.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    expect(localStorage.getItem('manna:post-draft:v2:bofm:mosiah:3:19')).toBe(draft)
  })

  it('聖典参照は編集させず、ラベルだけ表示する', () => {
    render(
      <PostEditor mode="sheet" post={editablePost} initialScripture={scripture} onSuccess={() => {}} />,
    )

    expect(screen.getByText(/モーサヤ書 3:19/)).toBeInTheDocument()
    expect(screen.queryByText('聖典参照（任意）')).toBeNull()
  })

  it('更新すると content と visibility だけを id 指定で送り、onSuccess を呼ぶ', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={onSuccess} />)

    await user.type(screen.getByPlaceholderText(/感じたこと/), 'を直した')
    await user.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce())
    expect(mockUpdate).toHaveBeenCalledWith({ content: '元の本文を直した', visibility: 'public' })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'p1')
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('更新が失敗したらエラーを出して onSuccess を呼ばない', async () => {
    const user = userEvent.setup()
    mockUpdateResult.mockResolvedValue({ data: null, error: { message: 'update failed' } })
    const onSuccess = vi.fn()
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={onSuccess} />)

    await user.type(screen.getByPlaceholderText(/感じたこと/), 'を直した')
    await user.click(screen.getByRole('button', { name: '更新する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/更新に失敗/)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('0 行しか返らなければ失敗として扱う', async () => {
    const user = userEvent.setup()
    mockUpdateResult.mockResolvedValue({ data: [], error: null })
    const onSuccess = vi.fn()
    render(<PostEditor mode="sheet" post={editablePost} onSuccess={onSuccess} />)

    await user.type(screen.getByPlaceholderText(/感じたこと/), 'を直した')
    await user.click(screen.getByRole('button', { name: '更新する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/更新に失敗/)
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
