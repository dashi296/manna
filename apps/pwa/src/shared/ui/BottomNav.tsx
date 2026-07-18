import { Link, useRouterState } from '@tanstack/react-router'
import { NAV_ITEMS, isNavItemActive } from '@/shared/config/navigation'
import { cn } from '@/shared/lib/utils'

export function BottomNav() {
  const { location } = useRouterState()

  return (
    <nav className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t border-line bg-[var(--header-bg)] backdrop-blur-sm">
      <div className="flex">
        {NAV_ITEMS.map((item) => {
          const { to, Icon } = item
          const label = 'shortLabel' in item ? item.shortLabel : item.label
          const active = isNavItemActive(to, location.pathname)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors',
                active ? 'text-lagoon-deep' : 'text-sea-ink-soft hover:text-sea-ink'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
