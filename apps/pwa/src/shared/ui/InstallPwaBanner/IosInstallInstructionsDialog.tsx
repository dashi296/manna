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
        <ol className="space-y-3 px-4 pb-4 text-sm">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 font-semibold">1.</span>
            <span className="flex-1">
              画面下部の共有ボタン
              <ShareIcon
                aria-hidden
                className="mx-1 inline-block h-4 w-4 align-text-bottom"
              />
              をタップ
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 font-semibold">2.</span>
            <span className="flex-1">「ホーム画面に追加」を選択</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 font-semibold">3.</span>
            <span className="flex-1">右上の「追加」をタップ</span>
          </li>
        </ol>
      </SheetContent>
    </Sheet>
  )
}
