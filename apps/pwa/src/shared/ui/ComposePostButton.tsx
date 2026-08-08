import type { ComponentProps } from 'react'
import { PenLine } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

type Props = ComponentProps<'button'> & {
  layout?: 'pill' | 'fab'
  label: string
}

export function ComposePostButton({ layout = 'pill', label, className, ...rest }: Props) {
  if (layout === 'fab') {
    return (
      <Button
        type="button"
        variant="accent"
        aria-label={label}
        className={cn(
          'fixed right-4 bottom-[calc(var(--bottom-nav-h)+var(--install-banner-h)+1rem)] z-30',
          'h-14 w-14 rounded-full p-0 shadow-lg [&_svg]:size-6',
          className,
        )}
        {...rest}
      >
        <PenLine aria-hidden="true" />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="accent"
      size="pill"
      className={cn('gap-1', className)}
      {...rest}
    >
      <PenLine size={12} aria-hidden="true" />
      <span>{label}</span>
    </Button>
  )
}
