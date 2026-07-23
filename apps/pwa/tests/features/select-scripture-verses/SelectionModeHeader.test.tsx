import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectionModeHeader } from '@/features/select-scripture-verses/ui/SelectionModeHeader'

describe('SelectionModeHeader', () => {
  it('count=0 で「節を選んでください」を表示し、投稿ボタンが disabled', () => {
    render(<SelectionModeHeader count={0} onCancel={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByText('節を選んでください')).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /節を選択してから投稿できます/ })
    expect(submit).toBeDisabled()
  })

  it('count=3 で「3節選択中」を表示し、投稿ボタンが有効', () => {
    render(<SelectionModeHeader count={3} onCancel={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByText('3節選択中')).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: /3節に投稿/ })
    expect(submit).not.toBeDisabled()
  })

  it('キャンセルをクリックで onCancel が呼ばれる', async () => {
    const onCancel = vi.fn()
    render(<SelectionModeHeader count={2} onCancel={onCancel} onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '選択をキャンセル' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('投稿をクリックで onSubmit が呼ばれる', async () => {
    const onSubmit = vi.fn()
    render(<SelectionModeHeader count={2} onCancel={vi.fn()} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: /2節に投稿/ }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('セーフエリア分の上部パディングクラスが付与される', () => {
    render(<SelectionModeHeader count={0} onCancel={vi.fn()} onSubmit={vi.fn()} />)
    const header = screen.getByRole('button', { name: '選択をキャンセル' }).closest('header')
    expect(header?.className).toContain('pt-[calc(0.5rem_+_var(--safe-area-top))]')
  })
})
