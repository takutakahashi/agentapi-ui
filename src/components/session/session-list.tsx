"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { formatDistanceToNow } from "@/lib/time-utils"
import { cn } from "@/lib/utils"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageSquare, CircleDot } from "lucide-react"

interface Session {
  id: string
  status: string
  repository?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

interface SessionListProps {
  searchQuery?: string
}

export function SessionList({ searchQuery = "" }: SessionListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/proxy/sessions", {
          credentials: "include",
        })
        if (response.ok) {
          const data = await response.json()
          setSessions(data.sessions || [])
        } else if (response.status === 401) {
          router.push("/login")
        } else {
          setError("Failed to fetch sessions")
        }
      } catch {
        setError("Failed to fetch sessions")
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()
    const interval = setInterval(fetchSessions, 10000)
    return () => clearInterval(interval)
  }, [router])

  const filteredSessions = React.useMemo(() => {
    if (!searchQuery) return sessions
    const query = searchQuery.toLowerCase()
    return sessions.filter(
      (session) =>
        session.id.toLowerCase().includes(query) ||
        session.repository?.toLowerCase().includes(query) ||
        session.tags?.some((tag) => tag.toLowerCase().includes(query))
    )
  }, [sessions, searchQuery])

  if (loading) {
    return (
      <SidebarMenu>
        {[...Array(5)].map((_, i) => (
          <SidebarMenuItem key={i}>
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        {error}
      </div>
    )
  }

  if (filteredSessions.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        {searchQuery ? "No sessions found" : "No sessions yet"}
      </div>
    )
  }

  return (
    <SidebarMenu>
      {filteredSessions.map((session) => {
        const isActive = pathname === `/chats/${session.id}`
        const statusColor = getStatusColor(session.status)

        return (
          <SidebarMenuItem key={session.id}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              className="h-auto py-3"
            >
              <a href={`/chats/${session.id}`}>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate font-medium text-sm">
                      {session.repository || session.id.slice(0, 8)}
                    </span>
                    <CircleDot
                      className={cn("h-2 w-2 shrink-0 ml-auto", statusColor)}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(session.updated_at))}
                    </span>
                    {session.tags && session.tags.length > 0 && (
                      <Badge variant="secondary" className="h-4 text-[10px]">
                        {session.tags[0]}
                      </Badge>
                    )}
                  </div>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case "running":
      return "text-yellow-500 animate-pulse"
    case "completed":
      return "text-green-500"
    case "failed":
      return "text-red-500"
    case "creating":
    case "starting":
      return "text-blue-500 animate-pulse"
    default:
      return "text-gray-400"
  }
}
