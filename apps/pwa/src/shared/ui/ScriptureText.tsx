import { useEffect, useRef, type CSSProperties } from 'react'
import DOMPurify from 'dompurify'
import { cn } from '@/shared/lib/utils'

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['ruby', 'rb', 'rt'],
  ALLOWED_ATTR: [],
}

// DOMPurify needs a real DOM `window` to sanitize against. This app's SSR/edge
// runtime (Cloudflare Workers via TanStack Start) has no DOM at all, so
// `sanitizeVerseHtml` must only ever run in the browser — e.g. from a
// `useEffect` after mount, never during a server render.
function sanitizeVerseHtml(textHtml: string): string {
  return DOMPurify.sanitize(textHtml, PURIFY_CONFIG)
}

type SanitizedVerseHtmlProps = {
  html: string
  className?: string
  style?: CSSProperties
  lang?: string
}

// Renders sanitized `text_html` by injecting it imperatively after mount
// (client-only), instead of `dangerouslySetInnerHTML`, so the raw HTML is
// never touched during SSR — avoiding both a server crash (no DOM to
// sanitize against) and ever serving unsanitized markup.
export function SanitizedVerseHtml({ html, className, style, lang }: SanitizedVerseHtmlProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = sanitizeVerseHtml(html)
    }
  }, [html])

  return <span ref={ref} className={className} style={style} lang={lang} />
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
        <span
          className="shrink-0 w-6 text-right text-xs font-medium pt-0.5"
          style={{ color: 'var(--sea-ink-soft)' }}
        >
          {verse}
        </span>
      )}
      <div className={cn('flex-1 min-w-0', textHtmlSecondary && 'flex flex-col gap-1 lg:flex-row lg:gap-4')}>
        <SanitizedVerseHtml
          html={textHtml}
          className={textHtmlSecondary ? 'lg:flex-1' : undefined}
          style={{ color: 'var(--sea-ink)' }}
        />
        {textHtmlSecondary && (
          <SanitizedVerseHtml
            html={textHtmlSecondary}
            className="lg:flex-1"
            style={{ color: 'var(--sea-ink-soft)' }}
            lang={secondaryLang}
          />
        )}
      </div>
    </div>
  )
}
