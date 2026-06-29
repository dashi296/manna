import Markdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { cn } from '@/shared/lib/utils'

const REMARK_PLUGINS = [remarkGfm, remarkBreaks]

type Props = {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={cn('prose prose-sm max-w-none break-words', className)}>
      <Markdown remarkPlugins={REMARK_PLUGINS}>{content}</Markdown>
    </div>
  )
}
