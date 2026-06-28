import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/shared/ui'
import { PostEditor } from '@/widgets/post-editor'
import type { ScriptureRefPartial } from '@/features/select-scripture'

type SearchParams = {
  collection?: string
  book?: string
  chapter?: string
  verses?: string
}

function parseSearchParams(search: SearchParams): ScriptureRefPartial | undefined {
  if (!search.collection) return undefined
  return {
    collection: search.collection,
    book: search.book,
    chapter: search.chapter ? parseInt(search.chapter, 10) : undefined,
    verses: search.verses
      ? search.verses.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
      : undefined,
  }
}

export const Route = createFileRoute('/posts/new')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    collection: search.collection as string | undefined,
    book: search.book as string | undefined,
    chapter: search.chapter as string | undefined,
    verses: search.verses as string | undefined,
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
