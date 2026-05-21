import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { getBook, getCollection } from '@/entities/scripture'

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
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{book.name}</h1>
      <div className="grid grid-cols-5 gap-2">
        {chapters.map((ch) => (
          <Link
            key={ch}
            to="/scriptures/$collection/$book/$chapter"
            params={{ collection: collection.id, book: book.id, chapter: String(ch) }}
            className="flex items-center justify-center h-12 border rounded-lg hover:bg-blue-50 hover:border-blue-300 text-sm font-medium"
          >
            {ch}
          </Link>
        ))}
      </div>
    </div>
  )
}
