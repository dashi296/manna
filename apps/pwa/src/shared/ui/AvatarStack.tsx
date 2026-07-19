export type AvatarStackItem = {
  userId: string
  name: string
  avatarUrl: string | null
}

type Props = {
  items: AvatarStackItem[]
  max?: number
  ariaLabel?: string
}

const SIZE = 20

export function AvatarStack({ items, max = 3, ariaLabel }: Props) {
  if (items.length === 0) return null
  const visible = items.slice(0, max)
  const overflow = Math.max(0, items.length - max)

  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center">
      {visible.map((item, i) => (
        <span
          key={item.userId}
          className="rounded-full shrink-0 overflow-hidden"
          style={{
            width: SIZE,
            height: SIZE,
            marginLeft: i === 0 ? 0 : -6,
            boxShadow: '0 0 0 1.5px var(--surface, #fff)',
            background: 'var(--lagoon)',
          }}
        >
          {item.avatarUrl ? (
            <img
              src={item.avatarUrl}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              role="img"
              aria-label={item.name}
              className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white"
            >
              {item.name.charAt(0).toUpperCase()}
            </span>
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
          style={{
            width: SIZE,
            height: SIZE,
            marginLeft: -6,
            background: 'var(--chip-bg)',
            border: '1px solid var(--chip-line)',
            color: 'var(--palm)',
            boxShadow: '0 0 0 1.5px var(--surface, #fff)',
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
