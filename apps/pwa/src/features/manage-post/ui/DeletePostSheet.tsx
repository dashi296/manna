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
import { useDeletePost } from '../model/useDeletePost'

type Props = {
  postId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeletePostSheet({ postId, open, onOpenChange }: Props) {
  const { remove, pending } = useDeletePost(postId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-6" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>投稿を削除しますか？</SheetTitle>
          <SheetDescription>削除した投稿は元に戻せません</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button onClick={remove} disabled={pending} variant="destructive">
            削除する
          </Button>
          <SheetClose render={<Button variant="outline" />}>キャンセル</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
