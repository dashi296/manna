import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getCollection } from '@/entities/scripture'
import { PageHeader } from '@/shared/ui'

export const Route = createFileRoute('/scriptures/$collection/')({
  loader: ({ params }) => {
    const collection = getCollection(params.collection)
    if (!collection) throw notFound()
    return collection
  },
  component: CollectionPage,
})

function CollectionPage() {
  const collection = Route.useLoaderData()
  return (
    <div>
      <PageHeader title={collection.name} backTo="/scriptures" backLabel="聖典" />
      <div className="p-4">
        <ul className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--line)' }}>
          {collection.books.map((book) => (
            <li key={book.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--line)' }}>
              <Link
                to="/scriptures/$collection/$book"
                params={{ collection: collection.id, book: book.id }}
                className="flex items-center justify-between px-4 py-3.5 transition-colors"
                style={{ color: 'var(--sea-ink)' }}
              >
                <span>{book.name}</span>
                <span className="text-sm" style={{ color: 'var(--sea-ink-soft)' }}>{book.chapters}章 ›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
