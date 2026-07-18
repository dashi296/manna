import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { NAV_ITEMS, isNavItemActive } from '@/shared/config/navigation'
import { getSession } from '@/shared/lib/auth'
import { UserAvatar } from '@/shared/ui/UserAvatar'
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

  const displayName = userInfo?.displayName ?? 'ユーザー'

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
                tooltip={displayName}
                render={<Link to="/profile" />}
              >
                <UserAvatar name={displayName} url={userInfo.avatarUrl} size="xs" />
                <span className="text-xs font-medium truncate">{displayName}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  )
}
