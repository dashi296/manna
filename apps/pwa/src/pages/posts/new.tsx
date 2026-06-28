import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/shared/ui'
import { PostEditor } from '@/widgets/post-editor'
import { parseVerses, type ScriptureRefPartial } from '@/features/select-scripture'

type SearchParams = {
  collection?: string
  book?: string
  chapter?: string
  verses?: string
}

function toStringOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function parseSearchParams(search: SearchParams): ScriptureRefPartial | undefined {
  if (!search.collection) return undefined
  return {
    collection: search.collection,
    book: search.book,
    chapter: search.chapter ? parseInt(search.chapter, 10) : undefined,
    verses: search.verses ? parseVerses(search.verses) : undefined,
  }
}

export const Route = createFileRoute('/posts/new')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    collection: toStringOrUndefined(search.collection),
    book: toStringOrUndefined(search.book),
    chapter: toStringOrUndefined(search.chapter),
    verses: toStringOrUndefined(search.verses),
  }),
  component: PostNewPage,
})

function PostNewPage() {
  const search = Route.useSearch()
  const initialScripture = parseSearchParams(search)

  return (
    <div>
      <PageHeader title="新しい投稿" backTo="/" backLabel="戻る" />
      <PostEditor initialScripture={initialScripture} />
    </div>
  )
}
