"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { MessageCircle, Eye, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Session } from "../../types/agentapi"
import StatusBadge from "./StatusBadge"
import { formatRelativeTime } from "../../utils/timeUtils"
import { truncateText } from "../../utils/textUtils"

interface SessionCardProps {
  session: Session
  onDelete?: (sessionId: string) => Promise<void>
  isDeleting?: boolean
}

export default function SessionCard({
  session,
  onDelete,
  isDeleting,
}: SessionCardProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)

    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const title =
    session.tags?.description ||
    session.metadata?.description ||
    `Session ${session.session_id.substring(0, 8)}`

  return (
    <div
      className={cn(
        "border-b border-border px-4 py-4 transition-colors duration-200",
        "hover:bg-accent/50"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title and status */}
          <div className="flex items-start gap-3 mb-2">
            <h3 className="text-sm sm:text-base font-medium leading-5 sm:leading-6 truncate">
              {truncateText(String(title), isMobile ? 100 : 120)}
            </h3>
            <StatusBadge status={session.status} />
          </div>

          {/* Session info */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground mb-3">
            <span className="font-mono">#{session.session_id.substring(0, 8)}</span>
            <span>Created: {formatRelativeTime(session.created_at)}</span>
            <span className="hidden sm:inline">
              Updated: {formatRelativeTime(session.updated_at)}
            </span>
            <span className="hidden sm:inline text-muted-foreground/70">
              by {session.user_id}
            </span>
            {session.environment?.WORKSPACE_NAME && (
              <Badge variant="muted" className="text-xs">
                {session.environment.WORKSPACE_NAME}
              </Badge>
            )}
          </div>

          {/* Metadata tags */}
          {session.metadata && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(session.metadata)
                .filter(([key]) => key !== "description")
                .slice(0, isMobile ? 2 : 10)
                .map(([key, value]) => (
                  <Badge
                    key={key}
                    variant="secondary"
                    className="text-xs font-normal"
                  >
                    <span className="hidden sm:inline">{key}: </span>
                    <span className="sm:hidden">{key.substring(0, 8)}: </span>
                    {String(value).substring(0, isMobile ? 8 : 20)}
                  </Badge>
                ))}
              {Object.entries(session.metadata).filter(
                ([key]) => key !== "description"
              ).length > 2 &&
                isMobile && (
                  <Badge variant="outline" className="text-xs">
                    +
                    {Object.entries(session.metadata).filter(
                      ([key]) => key !== "description"
                    ).length - 2}
                  </Badge>
                )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {session.status === "active" && (
            <Button asChild size="sm">
              <Link
                href={`/agentapi?session=${session.session_id}`}
                prefetch={true}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline ml-1.5">Chat</span>
              </Link>
            </Button>
          )}

          <Button asChild variant="outline" size="sm">
            <Link href={`/sessions/${session.session_id}`}>
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">Details</span>
            </Link>
          </Button>

          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(session.session_id)}
              disabled={isDeleting}
              aria-label={`Delete session ${session.session_id.substring(0, 8)}`}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline ml-1.5">
                {isDeleting ? "Deleting..." : "Delete"}
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
