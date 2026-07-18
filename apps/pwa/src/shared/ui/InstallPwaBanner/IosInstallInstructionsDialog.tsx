import { ShareIcon } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IosInstallInstructionsDialog({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-6">
        <SheetHeader>
          <SheetTitle>ホーム画面に追加</SheetTitle>
          <SheetDescription>
            Safari から数タップで追加できます
          </SheetDescription>
        </SheetHeader>
        <ol className="list-decimal list-outside space-y-3 pb-4 pl-10 pr-4 text-sm marker:font-semibold">
          <li>
            画面下部の共有ボタン
            <ShareIcon
              aria-hidden
              className="mx-1 inline-block h-4 w-4 align-text-bottom"
            />
            をタップ
          </li>
          <li>「ホーム画面に追加」を選択</li>
          <li>右上の「追加」をタップ</li>
        </ol>
      </SheetContent>
    </Sheet>
  )
}
