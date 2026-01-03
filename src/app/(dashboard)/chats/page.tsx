"use client"

import { MessageSquare, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function ChatsPage() {
  const router = useRouter()

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <MessageSquare className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold">Select a session</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a session from the sidebar or create a new one
        </p>
      </div>
      <Button className="mt-4" onClick={() => router.push("/chats")}>
        <Plus className="h-4 w-4 mr-2" />
        New Session
      </Button>
    </div>
  )
}
