"use client"

// shadcn/ui Sonner の vendored コード。upstream との意図的な差分:
// - next-themes の useTheme を外して theme="system" を直接渡す（このアプリに ThemeProvider は
//   無く、テーマは prefers-color-scheme だけで決まる。next-themes は依存からも削除済み）
// - dir="ltr" を明示（省くと sonner が既定値の算出で毎レンダー getComputedStyle を叩く）
// - toast を再 export（アプリ内でこのライブラリに触る窓口をここ1箇所にするため）

import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      dir="ltr"
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
export { toast } from "sonner"
