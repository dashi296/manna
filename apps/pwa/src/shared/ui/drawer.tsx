import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { XIcon } from "lucide-react"

import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/button"

type Side = "top" | "right" | "bottom" | "left"

const swipeDirectionForSide = {
  top: "up",
  right: "right",
  bottom: "down",
  left: "left",
} as const

const SideContext = React.createContext<Side>("bottom")

function Drawer({
  side = "bottom",
  ...props
}: DrawerPrimitive.Root.Props & { side?: Side }) {
  return (
    <SideContext.Provider value={side}>
      <DrawerPrimitive.Root
        swipeDirection={swipeDirectionForSide[side]}
        {...props}
      />
    </SideContext.Provider>
  )
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerOverlay({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 min-h-dvh bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

const viewportBySide: Record<Side, string> = {
  top: "items-start justify-center",
  bottom: "items-end justify-center",
  left: "items-stretch justify-start",
  right: "items-stretch justify-end",
}

// 上下シートは負の margin で背景を 3rem だけ画面外へはみ出させる（bleed）。
// スワイプで行き過ぎたときに画面端へ隙間が出ないようにするためで、
// はみ出させた分は閉じるときの移動量から引く
const popupBySide: Record<Side, string> = {
  top: "w-full max-h-[calc(85vh+3rem)] border-b -mt-12 pt-[calc(env(safe-area-inset-top,0px)+3rem)] [transform:translateY(var(--drawer-swipe-movement-y))] data-starting-style:[transform:translateY(calc(-100%+3rem-2px))] data-ending-style:[transform:translateY(calc(-100%+3rem-2px))]",
  bottom:
    "w-full max-h-[calc(85vh+3rem)] border-t -mb-12 pb-[calc(env(safe-area-inset-bottom,0px)+3rem)] [transform:translateY(var(--drawer-swipe-movement-y))] data-starting-style:[transform:translateY(calc(100%-3rem+2px))] data-ending-style:[transform:translateY(calc(100%-3rem+2px))]",
  left: "h-full w-3/4 sm:max-w-sm border-r [transform:translateX(var(--drawer-swipe-movement-x))] data-starting-style:[transform:translateX(calc(-100%-2px))] data-ending-style:[transform:translateX(calc(-100%-2px))]",
  right:
    "h-full w-3/4 sm:max-w-sm border-l [transform:translateX(var(--drawer-swipe-movement-x))] data-starting-style:[transform:translateX(calc(100%+2px))] data-ending-style:[transform:translateX(calc(100%+2px))]",
}

function DrawerContent({
  className,
  children,
  showCloseButton = true,
  showOverlay = true,
  ...props
}: DrawerPrimitive.Popup.Props & {
  showCloseButton?: boolean
  showOverlay?: boolean
}) {
  const side = React.useContext(SideContext)

  return (
    <DrawerPortal>
      {showOverlay && <DrawerOverlay />}
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        className={cn(
          "pointer-events-none fixed inset-0 z-50 flex",
          viewportBySide[side]
        )}
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          data-side={side}
          className={cn(
            // --popover は半透明。バックドロップを出さない使い方では背後の本文が
            // 透けて読めなくなるため、ヘッダーと同じすりガラスで背景を落ち着かせる
            "pointer-events-auto relative flex touch-none flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg outline-none supports-backdrop-filter:backdrop-blur-[16px] transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-swiping:select-none data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]",
            popupBySide[side],
            className
          )}
          {...props}
        >
          {side === "bottom" && (
            <div
              aria-hidden
              className="mx-auto mt-3 -mb-1 h-1 w-10 rounded-full bg-muted-foreground/30"
            />
          )}
          {children}
          {showCloseButton && (
            <DrawerPrimitive.Close
              data-slot="drawer-close"
              render={
                <Button
                  variant="ghost"
                  className="absolute top-3 right-3"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DrawerPrimitive.Close>
          )}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  )
}

// スワイプ判定と両立させるため、スクロールする領域は Drawer.Content に置く
function DrawerBody({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      data-slot="drawer-body"
      className={cn("touch-auto overflow-y-auto overscroll-contain", className)}
      {...props}
    />
  )
}

function DrawerHeader({
  className,
  bordered,
  style,
  ...props
}: React.ComponentProps<"div"> & { bordered?: boolean }) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-0.5 p-4", bordered && "border-b", className)}
      style={bordered ? { borderColor: "var(--line)", ...style } : style}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-base font-medium text-foreground", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerBody,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
