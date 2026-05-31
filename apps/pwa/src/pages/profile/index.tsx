import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/profile/')({
  component: () => <div className="p-4">プロフィール（実装予定）</div>,
})
