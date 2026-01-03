"use client"

import { ChatContainer } from "@/components/chat/chat-container"
import { use } from "react"

interface PageProps {
  params: Promise<{ sessionId: string }>
}

export default function ChatPage({ params }: PageProps) {
  const { sessionId } = use(params)

  return <ChatContainer sessionId={sessionId} />
}
