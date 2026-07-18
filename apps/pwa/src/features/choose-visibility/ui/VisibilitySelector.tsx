import { Globe, Users, Heart, Lock } from 'lucide-react'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import type { Visibility } from '@/entities/post'
import { cn } from '@/shared/lib/utils'

const VISIBILITY_OPTIONS = [
  { value: 'public', label: '全体公開', Icon: Globe },
  { value: 'followers', label: 'フォロワー', Icon: Users },
  { value: 'family', label: 'ファミリー', Icon: Heart },
  { value: 'private', label: '自分のみ', Icon: Lock },
] as const satisfies readonly { value: Visibility; label: string; Icon: typeof Globe }[]

type Props = {
  value: Visibility
  onChange: (value: Visibility) => void
}

export function VisibilitySelector({ value, onChange }: Props) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as Visibility)}
      className="flex flex-wrap gap-2"
    >
      {VISIBILITY_OPTIONS.map(({ value: v, label, Icon }) => (
        <Radio.Root
          key={v}
          value={v}
          aria-label={label}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-transparent px-3 py-1.5 text-xs font-medium ring-offset-background transition-colors',
            'hover:bg-muted hover:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'data-[checked]:bg-accent data-[checked]:text-accent-foreground',
            'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          )}
        >
          <Icon size={14} aria-hidden="true" />
          <span>{label}</span>
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
