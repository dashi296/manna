import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { SignOutButton } from '@/features/sign-out'
import { getSession } from '@/shared/lib/auth'
import { buttonVariants } from '@/shared/ui/button'

export function NotFoundPage() {
  // ログアウト導線を出すかの判定にしか使わないので、取得できなくても画面は出す
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    retry: false,
  })

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <h1 className="text-lg font-bold" style={{ color: 'var(--sea-ink)' }}>
          ページが見つかりません
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
          URL が変わったか、削除された可能性があります
        </p>
      </div>
      <div className="flex gap-2">
        <Link to="/" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          フィードへ戻る
        </Link>
        {/* 自分のユーザー行が消えるとプロフィールが 404 になり、そこにしかない
            ログアウトボタンに到達できなくなる。ここが最後の復帰手段になる（#73） */}
        {session && <SignOutButton />}
      </div>
    </div>
  )
}
