import { Globe, Users, Heart, Lock } from 'lucide-react'
import type { Visibility } from '@/entities/post'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

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
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => { if (v) onChange(v as Visibility) }}
      className="flex-wrap gap-2"
    >
      {VISIBILITY_OPTIONS.map(({ value: v, label, Icon }) => (
        <ToggleGroupItem
          key={v}
          value={v}
          aria-label={label}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <Icon size={14} aria-hidden="true" />
          <span>{label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
