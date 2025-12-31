import { Skeleton } from "../skeleton"

export function SessionCardSkeleton() {
  return (
    <div className="p-4 border-b border-border animate-fade-in">
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <Skeleton className="h-6 w-20 rounded-full" />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <Skeleton className="h-5 w-3/4 mb-2" />

          {/* Metadata row */}
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export function SessionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <SessionCardSkeleton key={i} />
      ))}
    </div>
  )
}
