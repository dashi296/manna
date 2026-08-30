import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { cn } from '@/shared/lib/utils'

function Menu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />
}

function MenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />
}

type MenuContentProps = MenuPrimitive.Popup.Props & {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

// Popover.Popup は role="dialog" を持つため流用できない（内側の role="menu" を
// 包んでしまい、スクリーンリーダーがメニューをダイアログと読み上げる）。
// Menu.Popup は role="menu" を自身に持ち、矢印キー移動とロービングタブ
// インデックスも標準で備える
function MenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: MenuContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={sideOffset} align={align} className="z-50">
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={cn(
            'min-w-[220px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none',
            'transition duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-sm text-sm outline-none cursor-pointer transition-colors',
        'data-highlighted:bg-muted',
        className,
      )}
      {...props}
    />
  )
}

export { Menu, MenuTrigger, MenuContent, MenuItem }
