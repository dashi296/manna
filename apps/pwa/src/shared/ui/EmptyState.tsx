import type { ReactNode } from 'react'

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="p-8 text-center text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
      {children}
    </div>
  )
}
