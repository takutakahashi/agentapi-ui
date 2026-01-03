"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Share, Trash2, MoreVertical, Copy, Check } from "lucide-react"
import { AgentStatus } from "@/hooks/use-messages"
import { cn } from "@/lib/utils"

interface ChatHeaderProps {
  sessionId: string
  repository?: string
  status: AgentStatus | null
  onDelete?: () => void
}

export function ChatHeader({
  sessionId,
  repository,
  status,
  onDelete,
}: ChatHeaderProps) {
  const router = useRouter()
  const [copied, setCopied] = React.useState(false)

  const handleCopyId = React.useCallback(() => {
    navigator.clipboard.writeText(sessionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [sessionId])

  const handleDelete = React.useCallback(async () => {
    if (!confirm("Are you sure you want to delete this session?")) return

    try {
      const response = await fetch(`/api/proxy/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        router.push("/chats")
        onDelete?.()
      }
    } catch (err) {
      console.error("Failed to delete session:", err)
    }
  }, [sessionId, router, onDelete])

  const statusConfig = React.useMemo(() => {
    if (!status) return { label: "Unknown", variant: "secondary" as const }
    switch (status.status) {
      case "running":
        return { label: "Running", variant: "warning" as const }
      case "stable":
        return { label: "Stable", variant: "success" as const }
      case "error":
        return { label: "Error", variant: "destructive" as const }
      default:
        return { label: status.status, variant: "secondary" as const }
    }
  }, [status])

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <h1 className="text-sm font-semibold truncate">
            {repository || `Session ${sessionId.slice(0, 8)}`}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyId}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {sessionId.slice(0, 8)}...
            </button>
            <Badge
              variant={statusConfig.variant}
              className={cn(
                "text-xs",
                status?.status === "running" && "animate-pulse"
              )}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCopyId}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Session ID
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Share className="h-4 w-4 mr-2" />
              Share Session
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
