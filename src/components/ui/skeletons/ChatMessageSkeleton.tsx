import { Skeleton } from "../skeleton"

interface ChatMessageSkeletonProps {
  isUser?: boolean
}

export function ChatMessageSkeleton({ isUser = false }: ChatMessageSkeletonProps) {
  return (
    <div
      className={`flex gap-3 p-4 animate-fade-in ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}

      <div
        className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
      >
        <Skeleton className={`h-4 ${isUser ? "w-48" : "w-64"}`} />
        <Skeleton className={`h-4 ${isUser ? "w-32" : "w-56"}`} />
        {!isUser && <Skeleton className="h-4 w-40" />}
      </div>

      {isUser && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}
    </div>
  )
}

export function ChatMessageListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <ChatMessageSkeleton key={i} isUser={i % 3 === 1} />
      ))}
    </div>
  )
}
