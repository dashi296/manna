type Size = '2xs' | 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<Size, { wh: string; text: string }> = {
  '2xs': { wh: 'w-6 h-6', text: 'text-[10px]' },
  xs: { wh: 'w-8 h-8', text: 'text-sm' },
  sm: { wh: 'w-9 h-9', text: 'text-sm' },
  md: { wh: 'w-10 h-10', text: 'text-sm' },
  lg: { wh: 'w-16 h-16', text: 'text-xl' },
}

type Props = {
  name: string
  url: string | null
  size?: Size
}

export function UserAvatar({ name, url, size = 'sm' }: Props) {
  const { wh, text } = SIZES[size]
  if (url) {
    return <img src={url} alt={name} className={`${wh} rounded-full object-cover shrink-0`} />
  }
  return (
    <span
      className={`${wh} rounded-full flex items-center justify-center ${text} font-bold shrink-0`}
      style={{ background: 'var(--lagoon)', color: '#fff' }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
