import { createFileRoute, Link } from '@tanstack/react-router'
import { getAllCollections } from '@/entities/scripture'
import { PageHeader } from '@/shared/ui/PageHeader'

export const Route = createFileRoute('/scriptures/')({
  component: ScripturesPage,
})

function ScripturesPage() {
  const collections = getAllCollections()
  return (
    <div>
      <PageHeader title="聖典" />
      <div className="p-4">
        <ul className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--line)' }}>
          {collections.map((col) => (
            <li key={col.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--line)' }}>
              <Link
                to="/scriptures/$collection"
                params={{ collection: col.id }}
                className="flex items-center justify-between px-4 py-3.5 transition-colors"
                style={{ color: 'var(--sea-ink)' }}
                activeProps={{ style: { color: 'var(--lagoon-deep)' } }}
              >
                <span className="font-medium">{col.name}</span>
                <span style={{ color: 'var(--sea-ink-soft)' }}>›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
