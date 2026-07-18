import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { NAV_ITEMS, isNavItemActive } from '@/shared/config/navigation'
import { getSession } from '@/shared/lib/auth'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/shared/ui/sidebar'

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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <span className="font-display text-2xl font-bold tracking-wide text-lagoon px-2 group-data-[collapsible=icon]:hidden">
            Manna
          </span>
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ to, label, Icon }) => {
                const active = isNavItemActive(to, location.pathname)
                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={label}
                      render={<Link to={to} />}
                    >
                      <Icon strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {userInfo && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip={userInfo.displayName ?? 'ユーザー'}
                render={<Link to="/profile" />}
              >
                {userInfo.avatarUrl ? (
                  <img
                    src={userInfo.avatarUrl}
                    alt={userInfo.displayName ?? 'ユーザー'}
                    className="size-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span
                    className="size-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-lagoon text-white"
                    aria-hidden="true"
                  >
                    {(userInfo.displayName ?? 'U').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="text-xs font-medium truncate">
                  {userInfo.displayName ?? 'ユーザー'}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  )
}
