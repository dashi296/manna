import { Link, useRouterState } from '@tanstack/react-router'
import { Home, BookOpen, PenLine, Bell, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getSession } from '@/shared/lib/auth'
import { cn } from '@/shared/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/sidebar'

const NAV_ITEMS = [
  { to: '/', label: 'フィード', Icon: Home },
  { to: '/scriptures', label: '聖典', Icon: BookOpen },
  { to: '/posts/new', label: '投稿する', Icon: PenLine },
  { to: '/notifications', label: '通知', Icon: Bell },
  { to: '/profile', label: 'プロフィール', Icon: User },
] as const

type UserInfo = { displayName: string | null; avatarUrl: string | null } | null

export function AppSidebar() {
  const { location } = useRouterState()
  const [userInfo, setUserInfo] = useState<UserInfo>(null)

  useEffect(() => {
    getSession().then((session) => {
      if (session?.user) {
        setUserInfo({
          displayName: session.user.user_metadata?.full_name ?? null,
          avatarUrl: session.user.user_metadata?.avatar_url ?? null,
        })
      }
    })
  }, [])

  return (
    <Sidebar
      collapsible="none"
      className="hidden lg:flex border-r"
      style={{ borderColor: 'var(--line)', background: 'var(--header-bg)', width: '220px' }}
    >
      {/* ロゴ */}
      <SidebarHeader className="px-4 py-5">
        <span
          className="font-display text-2xl font-bold tracking-wide"
          style={{ color: 'var(--lagoon)' }}
        >
          Manna
        </span>
      </SidebarHeader>

      {/* ナビゲーション */}
      <SidebarContent className="px-2">
        <SidebarMenu>
          {NAV_ITEMS.map(({ to, label, Icon }) => {
            const active =
              location.pathname === to ||
              (to !== '/' && location.pathname.startsWith(to))
            return (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton asChild isActive={active}>
                  <Link
                    to={to}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full',
                      active
                        ? 'text-lagoon-deep bg-[rgba(79,184,178,0.1)]'
                        : 'text-sea-ink-soft hover:text-sea-ink hover:bg-[var(--link-bg-hover)]'
                    )}
                  >
                    <Icon size={18} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                    {label}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* ユーザー情報（取得できた場合のみ表示） */}
      {userInfo && (
        <SidebarFooter className="px-4 py-4 border-t" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center gap-3">
            {userInfo.avatarUrl ? (
              <img
                src={userInfo.avatarUrl}
                alt={userInfo.displayName ?? 'ユーザー'}
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: 'var(--lagoon)', color: '#fff' }}
                aria-hidden="true"
              >
                {(userInfo.displayName ?? 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <span
              className="text-xs font-medium truncate"
              style={{ color: 'var(--sea-ink-soft)' }}
            >
              {userInfo.displayName ?? 'ユーザー'}
            </span>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
