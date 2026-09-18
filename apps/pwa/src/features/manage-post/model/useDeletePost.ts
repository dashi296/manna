import { useNavigate, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { invalidatePostLists } from '@/entities/user'
import { supabase } from '@/shared/lib/supabase'
import { toast } from '@/shared/ui/sonner'
import { useSingleFlight } from '@/shared/hooks/use-single-flight'

export function useDeletePost(postId: string) {
  const { pending, begin, end } = useSingleFlight()
  const router = useRouter()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const remove = async () => {
    if (!begin()) return

    const { data, error } = await supabase.from('posts').delete().eq('id', postId).select('id')

    // 0 行は RLS に拒否されたときも返る。削除が起きていない可能性があるので成功にしない
    if (error || !data?.length) {
      end()
      toast.error('削除に失敗しました')
      return
    }

    toast('投稿を削除しました')

    await invalidatePostLists(queryClient)

    // 直リンク流入では push すると削除済みの詳細が直前の履歴に残り、戻ると 404 になる
    if (router.history.canGoBack()) router.history.back()
    else navigate({ to: '/', replace: true })
  }

  return { remove, pending }
}
