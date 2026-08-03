import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/shared/ui/sonner'
import { invalidateRelationQueries } from './relationQueries'

type Options<V, T> = {
  current: T
  optimistic: (variables: V) => T
  run: (variables: V) => PromiseLike<{ error: unknown }>
  errorMessage: (variables: V) => string
}

// フォロー/ファミリーのように「操作すると関連する表示が一斉に古くなる」ミューテーション。
// shown は送信中だけ押した結果を先に見せ、確定後は呼び出し側が渡す current が正になる。
export function useRelationMutation<V, T>({ current, optimistic, run, errorMessage }: Options<V, T>) {
  const queryClient = useQueryClient()

  const { mutate, isPending, variables } = useMutation({
    mutationFn: async (variables: V) => {
      const { error } = await run(variables)
      // Supabase は失敗時も reject せず { error } を返すため、投げ直さないと成功扱いになる
      if (error) throw error
    },
    // Promise を返すと再取得の完了まで isPending が立ったままになり、楽観表示から実データへ
    // 切り替わる瞬間に表示が戻らない
    onSuccess: () => invalidateRelationQueries(queryClient),
    // 失敗時も無効化する: 相手の操作と競合して自分の変更が弾かれた場合、
    // 古いキャッシュのまま固まらず実際の状態に取り直す
    onError: (_error, variables) => {
      toast.error(errorMessage(variables))
      invalidateRelationQueries(queryClient)
    },
  })

  return {
    mutate,
    isPending,
    shown: isPending ? optimistic(variables) : current,
  }
}
