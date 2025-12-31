'use client'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'shimmer' | 'none'
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse'
}: SkeletonProps) {
  const baseClass = 'bg-gray-200 dark:bg-gray-700'

  const variantClass = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg'
  }

  const animationClass = {
    pulse: 'animate-pulse',
    shimmer: 'skeleton-shimmer',
    none: ''
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseClass} ${variantClass[variant]} ${animationClass[animation]} ${className}`}
      style={style}
    />
  )
}

// Pre-built skeleton components for common patterns

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={i === lines - 1 ? 'w-3/4' : 'w-full'}
          variant="text"
        />
      ))}
    </div>
  )
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }

  return <Skeleton className={sizeClass[size]} variant="circular" />
}

export function SkeletonButton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'h-8 w-16',
    md: 'h-10 w-24',
    lg: 'h-12 w-32'
  }

  return <Skeleton className={sizeClass[size]} variant="rounded" />
}

// Session Card Skeleton
export function SessionCardSkeleton() {
  return (
    <div className="card-modern p-4 sm:p-5 mb-3 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title and Status */}
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-5 flex-1 max-w-md" variant="text" />
            <Skeleton className="h-6 w-20" variant="rounded" />
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 mb-3">
            <Skeleton className="h-4 w-20" variant="text" />
            <Skeleton className="h-4 w-32" variant="text" />
            <Skeleton className="h-4 w-24 hidden sm:block" variant="text" />
          </div>

          {/* Tags */}
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" variant="rounded" />
            <Skeleton className="h-6 w-20" variant="rounded" />
            <Skeleton className="h-6 w-14 hidden sm:block" variant="rounded" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 sm:ml-4">
          <Skeleton className="h-10 w-24" variant="rounded" />
          <Skeleton className="h-10 w-20" variant="rounded" />
        </div>
      </div>
    </div>
  )
}

// Schedule Card Skeleton
export function ScheduleCardSkeleton() {
  return (
    <div className="card-modern p-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Skeleton className="h-6 w-48 mb-2" variant="text" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20" variant="rounded" />
            <Skeleton className="h-5 w-24" variant="rounded" />
          </div>
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-8 h-8" variant="rounded" />
            <Skeleton className="h-4 w-40" variant="text" />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <Skeleton className="h-9 w-16" variant="rounded" />
        <Skeleton className="h-9 w-24" variant="rounded" />
        <Skeleton className="h-9 w-28" variant="rounded" />
        <Skeleton className="h-9 w-16 ml-auto" variant="rounded" />
      </div>
    </div>
  )
}

// Conversation Card Skeleton
export function ConversationCardSkeleton() {
  return (
    <div className="card-modern p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Skeleton className="h-6 w-64 mb-2" variant="text" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-20" variant="rounded" />
            <Skeleton className="h-4 w-32" variant="text" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 ml-4">
          <Skeleton className="h-7 w-16" variant="rounded" />
          <Skeleton className="h-7 w-20" variant="rounded" />
        </div>
      </div>

      {/* Summary */}
      <Skeleton className="h-16 w-full mb-4" variant="rounded" />

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20" variant="rounded" />
          <Skeleton className="h-6 w-28" variant="rounded" />
        </div>
        <Skeleton className="h-8 w-24" variant="rounded" />
      </div>
    </div>
  )
}

// List Skeleton - renders multiple skeleton cards
export function SessionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SessionCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ScheduleListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ScheduleCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ConversationListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <ConversationCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" variant="text" />
        </td>
      ))}
    </tr>
  )
}

// Stats Card Skeleton
export function StatsCardSkeleton() {
  return (
    <div className="card-modern p-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-2" variant="text" />
          <Skeleton className="h-8 w-16" variant="text" />
        </div>
        <Skeleton className="w-12 h-12" variant="rounded" />
      </div>
    </div>
  )
}
