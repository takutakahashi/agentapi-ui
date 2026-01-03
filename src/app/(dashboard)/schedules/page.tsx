"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Calendar, Plus, Clock, Play, Pause, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface Schedule {
  id: string
  name: string
  cron_expression: string
  repository?: string
  enabled: boolean
  last_run?: string
  next_run?: string
  created_at: string
}

export default function SchedulesPage() {
  const router = useRouter()
  const [schedules, setSchedules] = React.useState<Schedule[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const response = await fetch("/api/proxy/schedules", {
          credentials: "include",
        })
        if (response.ok) {
          const data = await response.json()
          setSchedules(data.schedules || [])
        } else if (response.status === 401) {
          router.push("/login")
        }
      } catch (err) {
        console.error("Failed to fetch schedules:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchSchedules()
  }, [router])

  const toggleSchedule = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/proxy/schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: !enabled }),
      })
      if (response.ok) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === id ? { ...s, enabled: !enabled } : s))
        )
      }
    } catch (err) {
      console.error("Failed to toggle schedule:", err)
    }
  }

  const deleteSchedule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return
    try {
      const response = await fetch(`/api/proxy/schedules/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (response.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== id))
      }
    } catch (err) {
      console.error("Failed to delete schedule:", err)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-bold">Schedules</h1>
          <p className="text-sm text-muted-foreground">
            Manage automated session schedules
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Schedule
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Calendar className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="font-medium">No schedules</h3>
              <p className="text-sm text-muted-foreground">
                Create a schedule to automate your sessions
              </p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-card"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "p-2 rounded-full",
                      schedule.enabled
                        ? "bg-green-500/10 text-green-600"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{schedule.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <code>{schedule.cron_expression}</code>
                      {schedule.repository && (
                        <Badge variant="secondary" className="text-xs">
                          {schedule.repository}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={schedule.enabled ? "success" : "secondary"}>
                    {schedule.enabled ? "Active" : "Paused"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          toggleSchedule(schedule.id, schedule.enabled)
                        }
                      >
                        {schedule.enabled ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Resume
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteSchedule(schedule.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
