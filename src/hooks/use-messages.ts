"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

export interface Message {
  id: number
  role: "user" | "agent"
  content: string
  timestamp: string
}

export interface AgentStatus {
  status: "stable" | "running" | "error"
  last_activity?: string
  current_task?: string
}

interface UseMessagesOptions {
  sessionId: string
  pollInterval?: number
}

interface UseMessagesReturn {
  messages: Message[]
  status: AgentStatus | null
  loading: boolean
  sending: boolean
  error: string | null
  sendMessage: (content: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useMessages({
  sessionId,
  pollInterval = 3000,
}: UseMessagesOptions): UseMessagesReturn {
  const router = useRouter()
  const [messages, setMessages] = React.useState<Message[]>([])
  const [status, setStatus] = React.useState<AgentStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const eventSourceRef = React.useRef<EventSource | null>(null)

  const fetchMessages = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/proxy/sessions/${sessionId}/messages`, {
        credentials: "include",
      })

      if (response.status === 401) {
        router.push("/login")
        return
      }

      if (!response.ok) {
        throw new Error("Failed to fetch messages")
      }

      const data = await response.json()
      const fetchedMessages: Message[] = (data.messages || []).map(
        (msg: { id: string | number; role: string; content: string; created_at?: string }, index: number) => ({
          id: typeof msg.id === "number" ? msg.id : index,
          role: msg.role === "user" ? "user" : "agent",
          content: msg.content,
          timestamp: msg.created_at || new Date().toISOString(),
        })
      )
      setMessages(fetchedMessages)
      setError(null)
    } catch (err) {
      console.error("Failed to fetch messages:", err)
      setError("Failed to load messages")
    } finally {
      setLoading(false)
    }
  }, [sessionId, router])

  const fetchStatus = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/proxy/sessions/${sessionId}/status`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (err) {
      console.error("Failed to fetch status:", err)
    }
  }, [sessionId])

  const sendMessage = React.useCallback(
    async (content: string) => {
      if (!content.trim() || sending) return

      setSending(true)
      setError(null)

      // Optimistic update
      const tempMessage: Message = {
        id: Date.now(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, tempMessage])

      try {
        const response = await fetch(
          `/api/proxy/sessions/${sessionId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ role: "user", content }),
          }
        )

        if (!response.ok) {
          throw new Error("Failed to send message")
        }

        // Refresh messages to get the real message ID and any agent response
        await fetchMessages()
      } catch (err) {
        console.error("Failed to send message:", err)
        setError("Failed to send message")
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id))
      } finally {
        setSending(false)
      }
    },
    [sessionId, sending, fetchMessages]
  )

  // Subscribe to SSE events
  React.useEffect(() => {
    const eventSource = new EventSource(
      `/api/proxy/sessions/${sessionId}/events`,
      { withCredentials: true }
    )

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "message") {
          fetchMessages()
        } else if (data.type === "status") {
          setStatus(data.status)
        }
      } catch (err) {
        console.error("Failed to parse SSE event:", err)
      }
    }

    eventSource.onerror = () => {
      // Reconnect logic is handled by EventSource automatically
    }

    eventSourceRef.current = eventSource

    return () => {
      eventSource.close()
    }
  }, [sessionId, fetchMessages])

  // Initial fetch and polling
  React.useEffect(() => {
    fetchMessages()
    fetchStatus()

    const interval = setInterval(() => {
      fetchMessages()
      fetchStatus()
    }, pollInterval)

    return () => clearInterval(interval)
  }, [fetchMessages, fetchStatus, pollInterval])

  return {
    messages,
    status,
    loading,
    sending,
    error,
    sendMessage,
    refresh: fetchMessages,
  }
}
