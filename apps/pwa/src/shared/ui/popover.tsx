import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '@/shared/lib/utils'

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

type PopoverContentProps = PopoverPrimitive.Popup.Props & {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

function PopoverContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        sideOffset={sideOffset}
        align={align}
        className="z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'min-w-[220px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none',
            'transition duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
