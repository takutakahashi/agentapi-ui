"use client"

import * as React from "react"
import { use } from "react"
import { Bot } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "@/lib/time-utils"

interface Message {
  id: number
  role: "user" | "agent"
  content: string
  timestamp: string
}

interface SharedSession {
  id: string
  repository?: string
  messages: Message[]
  created_at: string
}

interface PageProps {
  params: Promise<{ shareToken: string }>
}

export default function SharedSessionPage({ params }: PageProps) {
  const { shareToken } = use(params)
  const [session, setSession] = React.useState<SharedSession | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/proxy/share/${shareToken}`)
        if (response.ok) {
          const data = await response.json()
          setSession({
            id: data.session_id,
            repository: data.repository,
            messages: (data.messages || []).map(
              (msg: { id: string | number; role: string; content: string; created_at?: string }, index: number) => ({
                id: typeof msg.id === "number" ? msg.id : index,
                role: msg.role === "user" ? "user" : "agent",
                content: msg.content,
                timestamp: msg.created_at || new Date().toISOString(),
              })
            ),
            created_at: data.created_at,
          })
        } else if (response.status === 404) {
          setError("Session not found or share link has expired")
        } else {
          setError("Failed to load session")
        }
      } catch {
        setError("Failed to load session")
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [shareToken])

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="border-b p-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`flex gap-3 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}
            >
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-16 w-64" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-xl font-semibold mb-2">Session Not Found</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b p-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <h1 className="font-semibold">
            {session?.repository || `Session ${session?.id.slice(0, 8)}`}
          </h1>
          <Badge variant="secondary">Shared</Badge>
        </div>
        {session?.created_at && (
          <p className="text-sm text-muted-foreground mt-1">
            Created {formatDistanceToNow(new Date(session.created_at))}
          </p>
        )}
      </header>

      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {session?.messages.map((message) => (
            <MessageItem
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
            />
          ))}
        </div>
      </ScrollArea>

      <footer className="border-t p-4 text-center text-sm text-muted-foreground">
        This is a read-only view of a shared session
      </footer>
    </div>
  )
}

function MessageItem({
  role,
  content,
  timestamp,
}: {
  role: "user" | "agent"
  content: string
  timestamp: string
}) {
  const isUser = role === "user"

  return (
    <div
      className={cn("flex gap-3 p-4", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <Avatar className={cn("h-8 w-8 shrink-0", isUser && "bg-primary")}>
        <AvatarFallback
          className={cn(
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isUser ? "U" : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn("flex flex-col gap-1 max-w-[80%]", isUser && "items-end")}
      >
        <div
          className={cn(
            "rounded-lg px-4 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          )}
        >
          <div className="whitespace-pre-wrap break-words">
            {formatTextWithLinks(content)}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(timestamp))}
        </span>
      </div>
    </div>
  )
}

function formatTextWithLinks(text: string): React.ReactNode {
  if (!text) return null

  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {part}
        </a>
      )
    }
    return part
  })
}
