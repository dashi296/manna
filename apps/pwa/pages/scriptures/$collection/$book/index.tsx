import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getBook, getCollection } from '@/entities/scripture'
import { PageHeader } from '@/shared/ui/PageHeader'

export const Route = createFileRoute('/scriptures/$collection/$book/')({
  loader: ({ params }) => {
    const book = getBook(params.collection, params.book)
    const collection = getCollection(params.collection)
    if (!book || !collection) throw notFound()
    return { book, collection }
  },
  component: BookPage,
})

function BookPage() {
  const { book, collection } = Route.useLoaderData()
  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1)
  return (
    <div>
      <PageHeader
        title={book.name}
        backTo="/scriptures/$collection"
        backLabel={collection.name}
      />
      <div className="p-4">
        <p className="text-xs mb-3" style={{ color: 'var(--sea-ink-soft)' }}>章を選んでください</p>
        <div className="grid grid-cols-5 gap-2">
          {chapters.map((ch) => (
            <Link
              key={ch}
              to="/scriptures/$collection/$book/$chapter"
              params={{ collection: collection.id, book: book.id, chapter: String(ch) }}
              className="flex items-center justify-center h-12 rounded-xl text-sm font-semibold transition-colors"
              style={{
                border: '1px solid var(--line)',
                color: 'var(--sea-ink)',
                background: 'var(--surface)',
              }}
            >
              {ch}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
