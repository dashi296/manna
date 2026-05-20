import { Link, useRouterState } from '@tanstack/react-router'

const NAV_ITEMS = [
  { to: '/', label: 'フィード', icon: '🏠' },
  { to: '/scriptures', label: '聖典', icon: '📖' },
  { to: '/posts/new', label: '投稿', icon: '✏️' },
  { to: '/notifications', label: '通知', icon: '🔔' },
  { to: '/profile', label: 'プロフィール', icon: '👤' },
] as const

export function BottomNav() {
  const { location } = useRouterState()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200">
      <div className="flex">
        {NAV_ITEMS.map((item) => {
          const active =
            location.pathname === item.to ||
            (item.to !== '/' && location.pathname.startsWith(item.to))
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center py-2 text-xs gap-1 ${
                active ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
