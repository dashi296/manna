import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'
import { signOut } from '@/shared/lib/auth'
import { redirectToLogin } from '../lib/redirectToLogin'

export function SignOutButton() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const confirm = async () => {
    if (pending) return
    setPending(true)
    try {
      await signOut()
      redirectToLogin()
    } catch {
      // 失敗時はシートを開いたまま、もう一度押せる状態に戻すだけにする
      setPending(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" size="sm">
        ログアウト
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="pb-6">
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
    </>
  )
}
