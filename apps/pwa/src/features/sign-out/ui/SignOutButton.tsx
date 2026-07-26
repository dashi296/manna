import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/shared/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/ui/sheet'
import { signOut } from '@/shared/lib/auth'

export function SignOutButton() {
  const [pending, setPending] = useState(false)
  const navigate = useNavigate()

  const confirm = async () => {
    setPending(true)
    try {
      await signOut()
      // 前のユーザーのローダーキャッシュを引き継がないよう、全体リロードで送る
      navigate({ to: '/login', replace: true, reloadDocument: true })
    } catch {
      setPending(false)
    }
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>ログアウト</SheetTrigger>
      <SheetContent side="bottom" className="pb-6" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>ログアウトしますか？</SheetTitle>
          <SheetDescription>
            再度 Google でサインインすればまた利用できます
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button onClick={confirm} disabled={pending} variant="destructive">
            ログアウトする
          </Button>
          <SheetClose render={<Button variant="outline" />}>キャンセル</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
