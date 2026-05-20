import { createFileRoute, Link } from '@tanstack/react-router'
import { getAllCollections } from '@/entities/scripture'

export const Route = createFileRoute('/scriptures/')({
  component: ScripturesPage,
})

function ScripturesPage() {
  const collections = getAllCollections()
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">聖典</h1>
      <ul className="divide-y border rounded-lg overflow-hidden">
        {collections.map((col) => (
          <li key={col.id}>
            <Link
              to="/scriptures/$collection"
              params={{ collection: col.id }}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <span className="font-medium">{col.name}</span>
              <span className="text-gray-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
