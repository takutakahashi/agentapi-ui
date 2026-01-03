"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bot, User, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "@/lib/time-utils"

interface MessageItemProps {
  role: "user" | "agent"
  content: string
  timestamp: string
}

// Extract PR URLs from message content
function extractPRUrls(text: string): string[] {
  if (!text) return []
  const prUrlRegex = /https?:\/\/[^\/\s]+\/[^\/\s]+\/[^\/\s]+\/pull\/\d+/g
  const matches = text.match(prUrlRegex)
  return matches ? Array.from(new Set(matches)) : []
}

// Extract Claude OAuth URLs from message content
function extractClaudeLoginUrls(text: string): string[] {
  if (!text) return []
  const claudeLoginRegex = /https?:\/\/claude\.ai\/oauth\/authorize\?[^\s]+/g
  const matches = text.match(claudeLoginRegex)
  return matches ? Array.from(new Set(matches)) : []
}

// Format text with clickable links
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

export function MessageItem({ role, content, timestamp }: MessageItemProps) {
  const isUser = role === "user"
  const prUrls = extractPRUrls(content)
  const claudeUrls = extractClaudeLoginUrls(content)

  return (
    <div
      className={cn(
        "flex gap-3 p-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className={cn("h-8 w-8 shrink-0", isUser && "bg-primary")}>
        <AvatarFallback
          className={cn(
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex flex-col gap-1 max-w-[80%]",
          isUser && "items-end"
        )}
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

        {/* PR URL Cards */}
        {prUrls.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {prUrls.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300 truncate">
                  {url.split("/").slice(-3).join("/")}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* Claude Login URL Cards */}
        {claudeUrls.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {claudeUrls.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Claude Code OAuth Login
                </span>
              </a>
            ))}
          </div>
        )}

        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(timestamp))}
        </span>
      </div>
    </div>
  )
}
