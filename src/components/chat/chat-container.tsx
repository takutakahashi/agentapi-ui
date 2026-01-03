"use client"

import * as React from "react"
import { useMessages } from "@/hooks/use-messages"
import { ChatHeader } from "./chat-header"
import { MessageList } from "./message-list"
import { MessageInput } from "./message-input"

interface ChatContainerProps {
  sessionId: string
  repository?: string
}

export function ChatContainer({ sessionId, repository }: ChatContainerProps) {
  const { messages, status, loading, sending, error, sendMessage } = useMessages({
    sessionId,
    pollInterval: 5000,
  })

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        sessionId={sessionId}
        repository={repository}
        status={status}
      />

      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <MessageList messages={messages} loading={loading} />

      <MessageInput onSend={sendMessage} disabled={loading} sending={sending} />
    </div>
  )
}
