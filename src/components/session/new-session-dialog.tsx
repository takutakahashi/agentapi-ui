"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface NewSessionDialogProps {
  trigger?: React.ReactNode
  onSessionCreated?: (sessionId: string) => void
}

export function NewSessionDialog({ trigger, onSessionCreated }: NewSessionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [repository, setRepository] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleCreate = async () => {
    setLoading(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        metadata: { source: "agentapi-ui" },
      }

      if (repository.trim()) {
        body.tags = { repository: repository.trim() }
      }

      const response = await fetch("/api/proxy/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const data = await response.json()
        const sessionId = data.session_id || data.id
        setOpen(false)
        setRepository("")

        if (onSessionCreated) {
          onSessionCreated(sessionId)
        } else {
          router.push(`/chats/${sessionId}`)
        }
      } else if (response.status === 401) {
        router.push("/login")
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.message || "Failed to create session")
      }
    } catch {
      setError("Failed to create session")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="w-full justify-start gap-2">
            <Plus className="h-4 w-4" />
            New Session
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
          <DialogDescription>
            Create a new chat session. You can optionally specify a repository.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label htmlFor="repository" className="text-sm font-medium">
              Repository (optional)
            </label>
            <Input
              id="repository"
              placeholder="owner/repo or https://github.com/owner/repo"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  handleCreate()
                }
              }}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Session"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
