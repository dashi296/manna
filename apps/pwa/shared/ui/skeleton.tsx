import { cn } from '@/shared/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md', className)}
      style={{ background: 'var(--line)' }}
      {...props}
    />
  )
}

export function PostCardSkeleton() {
  return (
    <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-start gap-3 mb-2">
        <Skeleton className="w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3 w-36 rounded" />
        </div>
        <Skeleton className="h-3 w-10 rounded" />
      </div>
      <div className="ml-12 space-y-1.5">
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3.5 w-5/6 rounded" />
        <Skeleton className="h-3.5 w-3/4 rounded" />
      </div>
    </div>
  )
}
