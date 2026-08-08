import { useEffect, useRef, useState } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  isIosSafari,
  isRecentlyDismissed,
  isStandalone,
  markDismissed,
} from '@/shared/lib/pwa'
import { IosInstallInstructionsDialog } from './IosInstallInstructionsDialog'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosDialogOpen, setIosDialogOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  // 同じ画面下部を使う FAB がバナーに隠れないよう、実測高さを CSS 変数で公開する
  useEffect(() => {
    const root = document.documentElement
    const bar = barRef.current
    if (!visible || !bar) {
      root.style.setProperty('--install-banner-h', '0px')
      return
    }
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--install-banner-h', `${bar.offsetHeight}px`)
    })
    observer.observe(bar)
    return () => {
      observer.disconnect()
      root.style.setProperty('--install-banner-h', '0px')
    }
  }, [visible])

  useEffect(() => {
    if (isStandalone()) return
    if (isRecentlyDismissed()) return

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const handleAppInstalled = () => {
      setVisible(false)
      setDeferredPrompt(null)
      markDismissed()
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    if (isIosSafari()) {
      setVisible(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      setVisible(false)
      await deferredPrompt.prompt()
      setDeferredPrompt(null)
      return
    }
    setIosDialogOpen(true)
  }

  const handleDismiss = () => {
    markDismissed()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <>
      <div
        role="region"
        aria-label="アプリのインストール案内"
        className="fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-40 lg:hidden pointer-events-none"
      >
        <div
          ref={barRef}
          className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 border-t bg-background px-3 py-2"
        >
          <img
            src="/logo192.png"
            alt=""
            className="h-8 w-8 shrink-0 rounded"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">アプリとして追加</p>
            <p className="truncate text-xs text-muted-foreground">
              ホーム画面から素早く開けます
            </p>
          </div>
          <Button size="sm" onClick={handleInstall}>
            追加
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleDismiss}
            aria-label="閉じる"
          >
            <XIcon />
          </Button>
        </div>
      </div>
      <IosInstallInstructionsDialog
        open={iosDialogOpen}
        onOpenChange={setIosDialogOpen}
      />
    </>
  )
}
