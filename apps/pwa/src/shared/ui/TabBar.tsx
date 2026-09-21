import { cn } from '@/shared/lib/utils'

type Tab<T extends string> = { id: T; label: string }

type Props<T extends string> = {
  tabs: Tab<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
  style?: React.CSSProperties
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
  style,
}: Props<T>) {
  return (
    <div className={`flex border-b border-border ${className}`} style={style}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
            active === t.id ? 'text-primary' : 'text-muted-foreground',
          )}
          style={{ borderColor: active === t.id ? 'var(--lagoon-deep)' : 'transparent' }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
