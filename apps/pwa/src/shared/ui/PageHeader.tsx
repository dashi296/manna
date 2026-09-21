import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const stickyHeaderBaseClassName = 'sticky top-0 z-10 border-b border-b-border'
export const stickyHeaderClassName = `${stickyHeaderBaseClassName} flex items-center gap-2`
// backdropFilter は position: fixed の子孫にとって containing block になるため、
// 画面固定したい要素（FAB など）はこのヘッダーの中ではなく兄弟として置くこと
export const stickyHeaderStyle: CSSProperties = {
  background: 'var(--header-bg)',
  backdropFilter: 'blur(8px)',
}

type Props = {
  title: string
  backTo?: string
  backLabel?: string
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, backTo, backLabel, action, className }: Props) {
  return (
    <header
      className={cn(
        stickyHeaderBaseClassName,
        // 左右を同じ 1fr にすると中央のカラムが画面の中心に来る。戻るリンクや
        // 操作が無いときも空の div を残すのは、欠けるとタイトルが左のカラムに
        // ずれ落ちるため
        'grid grid-cols-[1fr_auto_1fr] items-center gap-2',
        'px-4 pt-[var(--page-header-pt)] pb-3',
        className,
      )}
      style={stickyHeaderStyle}
    >
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo as string}
            search={{}}
            className="flex items-center gap-0.5 text-sm -ml-1 pr-2 text-primary"
            aria-label={backLabel ?? '戻る'}
          >
            <ChevronLeft size={18} aria-hidden="true" className="shrink-0" />
            {backLabel && <span className="truncate">{backLabel}</span>}
          </Link>
        )}
      </div>
      <h1 className="min-w-0 truncate text-center text-base font-bold text-foreground">{title}</h1>
      {/* min-w-0 を付けない。操作ボタンは縮むと重なるので、狭いときは
          代わりにタイトルと戻るラベルを省略させる */}
      <div className="flex justify-end">{action}</div>
    </header>
  )
}
