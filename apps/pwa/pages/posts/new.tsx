import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/new')({
  component: () => <div className="p-4">投稿作成（実装予定）</div>,
})
