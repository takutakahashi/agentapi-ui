"use client"

import * as React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageItem } from "./message-item"
import { Skeleton } from "@/components/ui/skeleton"
import { Message } from "@/hooks/use-messages"

interface MessageListProps {
  messages: Message[]
  loading?: boolean
}

export function MessageList({ messages, loading }: MessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true)

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (shouldAutoScroll && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, shouldAutoScroll])

  // Detect if user scrolled up
  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100
    setShouldAutoScroll(isAtBottom)
  }, [])

  if (loading) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-16 w-64" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>No messages yet. Start the conversation!</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1" onScroll={handleScroll}>
      <div className="flex flex-col">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
          />
        ))}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  )
}
