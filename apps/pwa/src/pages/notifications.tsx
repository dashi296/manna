import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/notifications')({
  component: () => <div className="p-4">通知（実装予定）</div>,
})
