import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export const stickyHeaderClassName = 'sticky top-0 z-10 flex items-center gap-2'
export const stickyHeaderStyle: CSSProperties = {
  background: 'var(--header-bg)',
  borderBottom: '1px solid var(--line)',
  backdropFilter: 'blur(8px)',
}

type Props = {
  title: string
  backTo?: string
  backLabel?: string
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, backTo, backLabel, action, className }: Props) {
  return (
    <header
      className={cn(stickyHeaderClassName, 'px-4 pt-[var(--page-header-pt)] pb-3', className)}
      style={stickyHeaderStyle}
    >
      {backTo && (
        <Link
          to={backTo as string}
          search={{}}
          className="flex items-center gap-0.5 text-sm -ml-1 pr-2"
          style={{ color: 'var(--lagoon-deep)' }}
          aria-label={backLabel ?? '戻る'}
        >
          <ChevronLeft size={18} aria-hidden="true" />
          {backLabel && <span>{backLabel}</span>}
        </Link>
      )}
      <h1 className="flex-1 text-base font-bold truncate" style={{ color: 'var(--sea-ink)' }}>
        {title}
      </h1>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
