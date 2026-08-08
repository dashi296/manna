import { useState } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { invalidatePostLists } from '@/entities/user'
import { supabase } from '@/shared/lib/supabase'
import { toast } from '@/shared/ui/sonner'

export function useDeletePost(postId: string) {
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const remove = async () => {
    if (pending) return
    setPending(true)

    const { data, error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .select('id')

    if (error) {
      setPending(false)
      toast.error('削除に失敗しました')
      return
    }

    // RLS 違反も別セッションでの削除済みも 0 行で返る。削除の意図は達成されて
    // いるので、どちらもエラーにせず一覧を取り直して戻す
    toast(data && data.length > 0 ? '投稿を削除しました' : '投稿は既に削除されています')

    await invalidatePostLists(queryClient)

    // 直リンク流入では push すると削除済みの詳細が直前の履歴に残り、戻ると 404 になる
    if (router.history.canGoBack()) router.history.back()
    else navigate({ to: '/', replace: true })
  }

  return { remove, pending }
}
