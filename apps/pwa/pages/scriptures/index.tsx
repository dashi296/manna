import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/scriptures/')({
  component: () => <div className="p-4">聖典（実装予定）</div>,
})
