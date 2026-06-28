import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/shared/lib/utils'

type Props = {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={cn('prose prose-sm max-w-none break-words', className)}>
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  )
}
