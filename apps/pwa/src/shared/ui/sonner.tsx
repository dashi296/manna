"use client"

import { memo } from "react"
import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const ICONS = {
  success: <CircleCheck className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  warning: <TriangleAlert className="h-4 w-4" />,
  error: <OctagonX className="h-4 w-4" />,
  loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
}

const TOAST_OPTIONS: ToasterProps["toastOptions"] = {
  classNames: {
    toast:
      "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
    description: "group-[.toast]:text-muted-foreground",
    actionButton:
      "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
    cancelButton:
      "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
  },
}

// shadcn の雛形は next-themes の useTheme を呼ぶが、このアプリに ThemeProvider は無く
// テーマは prefers-color-scheme だけで決まるため、sonner にも同じ判断をさせる。
// dir を省くと sonner が既定値の算出で毎レンダー getComputedStyle を叩くので明示する。
// memo するのは、置き場所の RootLayout が useRouterState() でナビゲーションのたびに
// 再レンダーされ、その都度 sonner が keydown リスナーを付け替えるため
const Toaster = memo((props: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      dir="ltr"
      className="toaster group"
      icons={ICONS}
      toastOptions={TOAST_OPTIONS}
      {...props}
    />
  )
})

export { Toaster }
