import type { LinkProps } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Bell, BookOpen, Home, PenLine, User } from 'lucide-react'

type NavItem = {
  to: LinkProps['to'] & string
  label: string
  shortLabel?: string
  Icon: LucideIcon
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'フィード', Icon: Home },
  { to: '/scriptures', label: '聖典', Icon: BookOpen },
  { to: '/posts/new', label: '投稿する', shortLabel: '投稿', Icon: PenLine },
  { to: '/notifications', label: '通知', Icon: Bell },
  { to: '/profile', label: 'プロフィール', Icon: User },
]

export function isNavItemActive(to: string, pathname: string): boolean {
  return pathname === to || (to !== '/' && pathname.startsWith(to))
}
