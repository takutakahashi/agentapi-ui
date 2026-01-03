"use client"

import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Send, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface MessageInputProps {
  onSend: (message: string) => Promise<void>
  disabled?: boolean
  sending?: boolean
}

export function MessageInput({ onSend, disabled, sending }: MessageInputProps) {
  const [message, setMessage] = React.useState("")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleSubmit = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!message.trim() || disabled || sending) return

      const content = message.trim()
      setMessage("")
      await onSend(content)

      // Refocus textarea after sending
      textareaRef.current?.focus()
    },
    [message, disabled, sending, onSend]
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [message])

  return (
    <form onSubmit={handleSubmit} className="border-t bg-background p-4">
      <div className="flex gap-2 items-end max-w-4xl mx-auto">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Cmd+Enter to send)"
          disabled={disabled || sending}
          rows={1}
          className={cn(
            "resize-none min-h-[44px] max-h-[200px]",
            "focus-visible:ring-1"
          )}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || disabled || sending}
          className="shrink-0 h-11 w-11"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Press Cmd+Enter or Ctrl+Enter to send
      </p>
    </form>
  )
}
