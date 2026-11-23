import { type CSSProperties } from 'react'
import { sanitizeVerseHtml } from '@/shared/lib/sanitizeVerseHtml'
import { cn } from '@/shared/lib/utils'

type SanitizedVerseHtmlProps = {
  html: string
  className?: string
  style?: CSSProperties
  lang?: string
}

// サーバーとクライアントで同じ文字列になるので、本文が SSR の HTML に入りハイドレーションでずれない（#205）
export function SanitizedVerseHtml({ html, className, style, lang }: SanitizedVerseHtmlProps) {
  return (
    <span
      className={cn('font-scripture', className)}
      style={style}
      lang={lang}
      dangerouslySetInnerHTML={{ __html: sanitizeVerseHtml(html) }}
    />
  )
}

type Props = {
  verse: number
  textHtml: string
  textHtmlSecondary?: string
  secondaryLang?: string
  className?: string
  showNumber?: boolean
}

export function ScriptureText({
  verse,
  textHtml,
  textHtmlSecondary,
  secondaryLang,
  className,
  showNumber = true,
}: Props) {
  return (
    <div className={cn('flex gap-2 py-2 text-sm leading-relaxed', className)}>
      {showNumber && (
        <span className="shrink-0 w-6 text-right text-xs font-medium pt-0.5 text-muted-foreground">
          {verse}
        </span>
      )}
      {textHtmlSecondary ? (
        <div className="flex-1 min-w-0 flex flex-col gap-1 lg:flex-row lg:gap-4">
          <SanitizedVerseHtml html={textHtml} className="lg:flex-1 text-foreground" />
          <SanitizedVerseHtml
            html={textHtmlSecondary}
            className="lg:flex-1 text-muted-foreground"
            lang={secondaryLang}
          />
        </div>
      ) : (
        <SanitizedVerseHtml html={textHtml} className="flex-1 min-w-0 text-foreground" />
      )}
    </div>
  )
}
