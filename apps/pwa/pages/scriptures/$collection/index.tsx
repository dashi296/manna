import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getCollection } from '@/entities/scripture'

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
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{collection.name}</h1>
      <ul className="divide-y border rounded-lg overflow-hidden">
        {collection.books.map((book) => (
          <li key={book.id}>
            <Link
              to="/scriptures/$collection/$book"
              params={{ collection: collection.id, book: book.id }}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <span>{book.name}</span>
              <span className="text-gray-400 text-sm">{book.chapters}章 ›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
