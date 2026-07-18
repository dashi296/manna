import { Bell, BookOpen, Home, PenLine, User } from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', label: 'フィード', Icon: Home },
  { to: '/scriptures', label: '聖典', Icon: BookOpen },
  { to: '/posts/new', label: '投稿する', shortLabel: '投稿', Icon: PenLine },
  { to: '/notifications', label: '通知', Icon: Bell },
  { to: '/profile', label: 'プロフィール', Icon: User },
] as const

export function isNavItemActive(to: string, pathname: string): boolean {
  return pathname === to || (to !== '/' && pathname.startsWith(to))
}
